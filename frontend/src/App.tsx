import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Collapse,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Class as ClassIcon,
  Functions as MethodIcon,
  Storage as PropertyIcon,
  DataObject as FieldIcon,
  NotificationsActive as EventIcon,
  Build as ConstructorIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Folder as FolderIcon,
  InsertDriveFile as InsertDriveFileIcon,
  BrowseGallery as BrowseIcon,
  Language as LanguageIcon,
  Menu as MenuIcon,
  Inventory2 as Inventory2Icon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { md3Theme, md3Colors } from './theme';
import type { Assembly, Tab, TreeNode } from './types';
import * as api from './api';
import './i18n';
import { changeLanguage } from './i18n';
import './App.css';
import FilePicker from './FilePicker';

// Tree Node Component
interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  onSelect: (node: TreeNode) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  t: (key: string) => string;
}

function TreeNodeItem({ node, level, onSelect, expandedIds, onToggle, t }: TreeNodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  const getIcon = (type: string) => {
    switch (type) {
      case 'assembly':
        return <InsertDriveFileIcon sx={{ color: md3Colors.primary, fontSize: 20 }} />;
      case 'namespace':
        return <FolderIcon sx={{ color: md3Colors.secondary, fontSize: 20 }} />;
      case 'class':
        return <ClassIcon sx={{ color: md3Colors.primary, fontSize: 18 }} />;
      case 'struct':
        return <ClassIcon sx={{ color: md3Colors.tertiary, fontSize: 18 }} />;
      case 'interface':
        return <ClassIcon sx={{ color: md3Colors.secondary, fontSize: 18 }} />;
      case 'enum':
        return <FieldIcon sx={{ color: md3Colors.tertiary, fontSize: 18 }} />;
      case 'delegate':
        return <MethodIcon sx={{ color: md3Colors.secondary, fontSize: 18 }} />;
      case 'method':
        return <MethodIcon sx={{ color: md3Colors.primary, fontSize: 16 }} />;
      case 'property':
        return <PropertyIcon sx={{ color: md3Colors.secondary, fontSize: 16 }} />;
      case 'field':
        return <FieldIcon sx={{ color: md3Colors.tertiary, fontSize: 16 }} />;
      case 'event':
        return <EventIcon sx={{ color: md3Colors.error, fontSize: 16 }} />;
      case 'constructor':
        return <ConstructorIcon sx={{ color: md3Colors.onPrimaryContainer, fontSize: 16 }} />;
      default:
        return <CodeIcon sx={{ fontSize: 18 }} />;
    }
  };

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
    if (node.type !== 'namespace' && node.type !== 'assembly') {
      onSelect(node);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  return (
    <Box>
      <ListItemButton
        onClick={handleClick}
        sx={{
          pl: level * 2 + 1,
          py: 0.5,
          borderRadius: 2,
          '&:hover': { bgcolor: 'rgba(208, 188, 255, 0.08)' },
        }}
      >
        {hasChildren ? (
          <ListItemIcon sx={{ minWidth: 24 }} onClick={handleToggle}>
            {isExpanded ? (
              <ExpandLessIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            )}
          </ListItemIcon>
        ) : (
          <Box sx={{ width: 24 }} />
        )}
        <ListItemIcon sx={{ minWidth: 28 }}>
          {getIcon(node.type)}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: node.type === 'namespace' ? 500 : 400,
            noWrap: true,
          }}
        />
        {hasChildren && (
          <Chip
            label={node.children!.length}
            size="small"
            sx={{ height: 18, fontSize: 10, bgcolor: md3Colors.surfaceVariant }}
          />
        )}
      </ListItemButton>
      
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {node.children!.map((child) => (
              <TreeNodeItem
                key={child.id}
                node={child}
                level={level + 1}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
                t={t}
              />
            ))}
          </List>
        </Collapse>
      )}
    </Box>
  );
}

// Sortable Assembly Item
interface SortableAssemblyItemProps {
  assembly: Assembly;
  isActive: boolean;
  onSelect: (id: string) => void;
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, assembly: Assembly) => void;
}

function SortableAssemblyItem({
  assembly,
  isActive,
  onSelect,
  onMenuOpen,
}: SortableAssemblyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assembly.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(assembly.id)}
      sx={{
        mb: 0.5,
        bgcolor: isActive ? 'rgba(208, 188, 255, 0.12)' : 'transparent',
        borderRadius: 3,
        border: isActive ? '1px solid' : '1px solid transparent',
        borderColor: isActive ? 'primary.main' : 'transparent',
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, cursor: 'grab' }} {...attributes} {...listeners}>
        <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
      </ListItemIcon>
      <ListItemIcon sx={{ minWidth: 28 }}>
        <InsertDriveFileIcon sx={{ color: md3Colors.primary, fontSize: 20 }} />
      </ListItemIcon>
      <ListItemText
        primary={assembly.name}
        secondary={`v${assembly.version}`}
        primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onMenuOpen(e, assembly);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </ListItemButton>
  );
}

// Main App
function App() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [currentAssembly, setCurrentAssembly] = useState<Assembly | null>(null);
  const [trees, setTrees] = useState<Map<string, TreeNode>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [code, setCode] = useState<string>('');
  const [status, setStatus] = useState<string>(t('ready'));
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [langMenuAnchor, setLangMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // Resizable panel heights
  const [assemblyListHeight, setAssemblyListHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startY: e.clientY, startHeight: assemblyListHeight };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientY - resizeRef.current.startY;
      const newHeight = Math.max(80, Math.min(400, resizeRef.current.startHeight + delta));
      setAssemblyListHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    loadAssemblies();
  }, []);

  const loadAssemblies = async () => {
    try {
      const data = await api.getAssemblies();
      setAssemblies(data.assemblies);
    } catch (error) {
      setSnackbar({ open: true, message: t('cannotConnect'), severity: 'error' });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setStatus(t('uploading'));
    try {
      await api.uploadFiles(files);
      setSnackbar({ open: true, message: t('uploadSuccess'), severity: 'success' });
      await loadAssemblies();
    } catch (error) {
      setSnackbar({ open: true, message: t('uploadFailed'), severity: 'error' });
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    setLoading(true);
    try {
      await api.uploadFiles(files);
      await loadAssemblies();
    } catch (error) {
      setSnackbar({ open: true, message: t('uploadFailed'), severity: 'error' });
    }
    setLoading(false);
  };

  const handleAssemblySelect = async (id: string) => {
    const assembly = assemblies.find((a) => a.id === id);
    if (!assembly) return;

    setLoading(true);
    setCurrentAssembly(assembly);
    setStatus(t('loadingTypes'));

    try {
      const data = await api.getTypes(id);
      const tree = api.buildTree(assembly, data.types);
      setTrees(prev => new Map(prev).set(id, tree));
      setExpandedIds(new Set([id]));
      
      const newTab: Tab = {
        id: assembly.id,
        name: assembly.name,
        kind: 'assembly',
        fullName: assembly.name,
        assemblyId: assembly.id,
      };

      if (!tabs.find((t) => t.id === newTab.id)) {
        setTabs((prev) => [...prev, newTab]);
      }
      setActiveTab(newTab);

      const decompiled = await api.decompile(id);
      setCode(decompiled.code || `// ${t('cannotDecompile')}`);
      setStatus(`${t('loaded')}: ${assembly.name}`);
    } catch (error) {
      setSnackbar({ open: true, message: t('loadFailed'), severity: 'error' });
    }
    setLoading(false);
  };

  const handleNodeSelect = async (node: TreeNode) => {
    if (!currentAssembly || node.type === 'namespace') return;

    const tabId = `${currentAssembly.id}:${node.fullName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(existingTab);
    } else {
      const newTab: Tab = {
        id: tabId,
        name: node.name,
        kind: node.type,
        fullName: node.fullName,
        assemblyId: currentAssembly.id,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(newTab);
    }

    setLoading(true);
    try {
      const data = await api.decompile(currentAssembly.id, node.fullName);
      setCode(data.code || `// ${t('cannotDecompileType')}`);
      setStatus(`${t('loaded')}: ${node.fullName}`);
    } catch (error) {
      setSnackbar({ open: true, message: t('decompileFailed'), severity: 'error' });
    }
    setLoading(false);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTabSelect = async (tab: Tab) => {
    setActiveTab(tab);
    if (tab.assemblyId) {
      const asm = assemblies.find(a => a.id === tab.assemblyId);
      if (asm) setCurrentAssembly(asm);
      
      if (tab.kind !== 'assembly') {
        const data = await api.decompile(tab.assemblyId, tab.fullName);
        setCode(data.code || '');
      } else {
        const data = await api.decompile(tab.assemblyId);
        setCode(data.code || '');
      }
    }
  };

  const handleTabClose = (tabId: string) => {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTab?.id === tabId) {
      const newActiveTab = newTabs[Math.min(index, newTabs.length - 1)] || null;
      setActiveTab(newActiveTab);
      if (newActiveTab?.assemblyId) {
        if (newActiveTab.kind !== 'assembly') {
          api.decompile(newActiveTab.assemblyId, newActiveTab.fullName).then((d) => setCode(d.code || ''));
        } else {
          api.decompile(newActiveTab.assemblyId).then((d) => setCode(d.code || ''));
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAssemblies((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Tab drag and drop
  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, assembly: Assembly) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedAssembly(assembly);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleOpenInFileManager = async () => {
    if (!selectedAssembly) return;
    try {
      await api.openInFileManager(selectedAssembly.id);
      setSnackbar({ open: true, message: t('openedInFileManager'), severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('openFileManagerFailed'), severity: 'error' });
    }
    handleMenuClose();
  };

  const handleExportProject = async () => {
    if (!selectedAssembly) return;
    setLoading(true);
    setStatus(t('exporting'));
    try {
      const result = await api.exportProject(selectedAssembly.id);
      setSnackbar({ open: true, message: `${t('exportSuccess')}: ${result.path}`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('exportFailed'), severity: 'error' });
    }
    setLoading(false);
    setStatus('');
    handleMenuClose();
  };

  const handleDeleteAssembly = async () => {
    if (!selectedAssembly) return;

    try {
      await api.deleteAssembly(selectedAssembly.id);
      setAssemblies((prev) => prev.filter((a) => a.id !== selectedAssembly.id));
      setTrees(prev => {
        const next = new Map(prev);
        next.delete(selectedAssembly.id);
        return next;
      });
      if (currentAssembly?.id === selectedAssembly.id) {
        setCurrentAssembly(null);
        setCode('');
        setTabs([]);
        setActiveTab(null);
      }
      setSnackbar({ open: true, message: `${t('deleteSuccess')}: ${selectedAssembly.name}`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('deleteFailed'), severity: 'error' });
    }
    handleMenuClose();
  };

  const handleOpenFromPath = async (filePath: string) => {
    setLoading(true);
    setStatus(t('loadingTypes'));
    
    try {
      const response = await fetch(`/api/fs/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await response.json();
      
      if (data.error) {
        setSnackbar({ open: true, message: data.error, severity: 'error' });
      } else if (data.assembly) {
        await loadAssemblies();
        setTimeout(() => handleAssemblySelect(data.assembly.id), 100);
        setSnackbar({ open: true, message: `${t('loaded')}: ${data.assembly.name}`, severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('loadFailed'), severity: 'error' });
    }
    
    setLoading(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const allResults: any[] = [];
      for (const asm of assemblies) {
        try {
          const data = await api.search(asm.id, query);
          allResults.push(...data.results.map((r) => ({ ...r, assemblyId: asm.id, assembly: asm.name })));
        } catch (e) {}
      }
      setSearchResults(allResults);
    }, 300);
  };

  const handleSearchResultSelect = async (result: any) => {
    setShowSearchResults(false);
    setSearchQuery('');

    if (result.assemblyId && result.assemblyId !== currentAssembly?.id) {
      await handleAssemblySelect(result.assemblyId);
    }
    if (result.kind === 'type' || result.typeName) {
      await handleNodeSelect({
        id: result.fullName,
        name: result.name,
        fullName: result.typeName || result.fullName,
        type: result.kind,
        assemblyId: result.assemblyId,
      });
    }
  };

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang);
    setLangMenuAnchor(null);
  };

  return (
    <ThemeProvider theme={md3Theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        {/* AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: md3Colors.surfaceContainer,
            borderBottom: 1,
            borderColor: 'outline.variant',
          }}
        >
          <Toolbar sx={{ gap: { xs: 1, md: 2 } }}>
            {/* Mobile menu button */}
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${md3Colors.primary}, ${md3Colors.secondary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" sx={{ color: md3Colors.onPrimary, fontWeight: 700 }}>
                  D
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {t('appTitle')}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            
            {/* Language Switcher */}
            <IconButton onClick={(e) => setLangMenuAnchor(e.currentTarget)}>
              <LanguageIcon />
            </IconButton>
            <Menu
              anchorEl={langMenuAnchor}
              open={Boolean(langMenuAnchor)}
              onClose={() => setLangMenuAnchor(null)}
            >
              <MenuItem onClick={() => handleLanguageChange('en')} selected={i18n.language === 'en'}>
                English
              </MenuItem>
              <MenuItem onClick={() => handleLanguageChange('zh')} selected={i18n.language === 'zh'}>
                中文
              </MenuItem>
            </Menu>
            
            {/* Desktop buttons */}
            {!isMobile && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<BrowseIcon />}
                  onClick={() => setFilePickerOpen(true)}
                  sx={{ mr: 1 }}
                >
                  {t('browseFiles')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('uploadFiles')}
                </Button>
              </>
            )}
            
            {/* Mobile upload buttons */}
            {isMobile && (
              <>
                <IconButton onClick={() => setFilePickerOpen(true)}>
                  <BrowseIcon />
                </IconButton>
                <IconButton onClick={() => fileInputRef.current?.click()}>
                  <FolderOpenIcon />
                </IconButton>
              </>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".dll,.exe"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Toolbar>
        </AppBar>

        {/* Main Layout */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar - Desktop */}
          {!isMobile && (
            <Paper
              elevation={0}
              sx={{
                width: 320,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: md3Colors.surfaceContainer,
                borderRight: 1,
                borderColor: 'outline.variant',
                borderRadius: 0,
              }}
            >
              {/* Search */}
              <Box sx={{ p: 1.5, position: 'relative' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: md3Colors.surfaceContainerHigh,
                      borderRadius: 3,
                    },
                  }}
                />
                {showSearchResults && searchResults.length > 0 && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      zIndex: 1000,
                      width: 284,
                      mt: 0.5,
                      maxHeight: 300,
                      overflow: 'auto',
                      bgcolor: md3Colors.surfaceContainerHigh,
                    }}
                  >
                    <List dense>
                      {searchResults.slice(0, 10).map((result, i) => (
                        <ListItemButton key={i} onMouseDown={() => handleSearchResultSelect(result)}>
                          <ListItemText
                            primary={result.name}
                            secondary={result.fullName}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                          />
                          <Chip label={result.kind} size="small" sx={{ ml: 1 }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>

              {/* Assembly List - Resizable */}
              <Box sx={{ flex: '0 0 auto', height: assemblyListHeight, overflow: 'auto' }}>
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                  {t('assemblies')}
                </Typography>
                {assemblies.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      color: 'text.secondary',
                      border: 1,
                      borderStyle: 'dashed',
                      borderColor: 'outline.variant',
                      borderRadius: 3,
                      mx: 1.5,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <Typography variant="body2">{t('dragDropHint')}</Typography>
                  </Box>
                ) : (
                  <List dense sx={{ px: 1 }}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={assemblies.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                        {assemblies.map((assembly) => (
                          <SortableAssemblyItem
                            key={assembly.id}
                            assembly={assembly}
                            isActive={currentAssembly?.id === assembly.id}
                            onSelect={handleAssemblySelect}
                            onMenuOpen={handleMenuOpen}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </List>
                )}
              </Box>

              {/* Resizable Divider */}
              <Box
                onMouseDown={handleResizeStart}
                sx={{
                  height: 6,
                  cursor: 'row-resize',
                  bgcolor: isResizing ? 'primary.main' : 'divider',
                  transition: 'background 0.2s',
                  '&:hover': { bgcolor: 'primary.main', opacity: 0.5 },
                  zIndex: 10,
                }}
              />

              {/* Tree View */}
              {currentAssembly && trees.has(currentAssembly.id) && (
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 100 }}>
                  <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                    {t('typeBrowser')}
                  </Typography>
                  <List dense sx={{ px: 0.5 }}>
                    <TreeNodeItem
                      node={trees.get(currentAssembly.id)!}
                      level={0}
                      onSelect={handleNodeSelect}
                      expandedIds={expandedIds}
                      onToggle={handleToggleExpand}
                      t={t}
                    />
                  </List>
                </Box>
              )}
            </Paper>
          )}

          {/* Mobile Drawer */}
          <Drawer
            anchor="left"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            PaperProps={{
              sx: {
                width: { xs: '85vw', sm: 320 },
                maxWidth: 360,
                bgcolor: md3Colors.surfaceContainer,
              },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Drawer Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={600}>{t('appTitle')}</Typography>
                <IconButton onClick={() => setMobileDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
              
              {/* Search */}
              <Box sx={{ p: 1.5, position: 'relative' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: md3Colors.surfaceContainerHigh,
                      borderRadius: 3,
                    },
                  }}
                />
                {showSearchResults && searchResults.length > 0 && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      zIndex: 1000,
                      left: 12,
                      right: 12,
                      mt: 0.5,
                      maxHeight: 300,
                      overflow: 'auto',
                      bgcolor: md3Colors.surfaceContainerHigh,
                    }}
                  >
                    <List dense>
                      {searchResults.slice(0, 10).map((result, i) => (
                        <ListItemButton 
                          key={i} 
                          onMouseDown={() => {
                            handleSearchResultSelect(result);
                            setMobileDrawerOpen(false);
                          }}
                        >
                          <ListItemText
                            primary={result.name}
                            secondary={result.fullName}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                          />
                          <Chip label={result.kind} size="small" sx={{ ml: 1 }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>

              {/* Assembly List */}
              <Box sx={{ flex: '0 0 auto', maxHeight: '40%', overflow: 'auto' }}>
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                  {t('assemblies')}
                </Typography>
                {assemblies.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">{t('dragDropHint')}</Typography>
                  </Box>
                ) : (
                  <List dense sx={{ px: 1 }}>
                    {assemblies.map((assembly) => (
                      <ListItemButton
                        key={assembly.id}
                        onClick={() => {
                          handleAssemblySelect(assembly.id);
                          setMobileDrawerOpen(false);
                        }}
                        selected={currentAssembly?.id === assembly.id}
                        sx={{
                          mb: 0.5,
                          borderRadius: 3,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <InsertDriveFileIcon sx={{ color: md3Colors.primary, fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={assembly.name}
                          secondary={`v${assembly.version}`}
                          primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, assembly);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>

              <Divider />

              {/* Tree View */}
              {currentAssembly && trees.has(currentAssembly.id) && (
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 100 }}>
                  <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                    {t('typeBrowser')}
                  </Typography>
                  <List dense sx={{ px: 0.5 }}>
                    <TreeNodeItem
                      node={trees.get(currentAssembly.id)!}
                      level={0}
                      onSelect={(node) => {
                        handleNodeSelect(node);
                        setMobileDrawerOpen(false);
                      }}
                      expandedIds={expandedIds}
                      onToggle={handleToggleExpand}
                      t={t}
                    />
                  </List>
                </Box>
              )}
            </Box>
          </Drawer>

          {/* Main Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tabs */}
            {tabs.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  bgcolor: md3Colors.surfaceContainer,
                  borderBottom: 1,
                  borderColor: 'outline.variant',
                  borderRadius: 0,
                  overflowX: 'auto',
                }}
              >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
                  <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
                    {tabs.map((tab) => (
                      <SortableTabItem
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab?.id === tab.id}
                        onSelect={handleTabSelect}
                        onClose={handleTabClose}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </Paper>
            )}

            {/* Editor */}
            <Box
              sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {loading && (
                <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {tabs.length === 0 ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 2,
                    borderStyle: 'dashed',
                    borderColor: 'outline.variant',
                    borderRadius: 4,
                    m: 3,
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Inventory2Icon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" color="text.primary">{t('dragDropHere')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('supportedFormats')}</Typography>
                </Box>
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage="csharp"
                  theme="vs-dark"
                  value={code}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>

        {/* Status Bar */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            px: 2,
            py: 0.5,
            bgcolor: md3Colors.surfaceContainer,
            borderTop: 1,
            borderColor: 'outline.variant',
            borderRadius: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary">{status}</Typography>
          <Typography variant="caption" color="text.secondary">{currentAssembly?.name}</Typography>
        </Paper>

        {/* Context Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={handleOpenInFileManager}>
            <ListItemIcon>
              <FolderOpenIcon />
            </ListItemIcon>
            {t('openInFileManager')}
          </MenuItem>
          <MenuItem onClick={handleExportProject}>
            <ListItemIcon>
              <CodeIcon />
            </ListItemIcon>
            {t('exportAsProject')}
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleDeleteAssembly} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            {t('deleteAssembly')}
          </MenuItem>
        </Menu>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* File Picker */}
        <FilePicker
          open={filePickerOpen}
          onClose={() => setFilePickerOpen(false)}
          onSelect={handleOpenFromPath}
        />
      </Box>
    </ThemeProvider>
  );
}

// Sortable Tab Item Component
interface SortableTabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: (tab: Tab) => void;
  onClose: (id: string) => void;
}

const SortableTabItem = ({ tab, isActive, onSelect, onClose }: SortableTabItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(tab)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        cursor: 'grab',
        borderBottom: 2,
        borderColor: isActive ? 'primary.main' : 'transparent',
        color: isActive ? 'primary.main' : 'text.secondary',
        '&:hover': { bgcolor: 'rgba(208, 188, 255, 0.08)' },
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <Typography variant="body2" fontWeight={500} sx={{ mr: 1 }}>
        {tab.name}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        sx={{ p: 0.25 }}
      >
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
};

export default App;

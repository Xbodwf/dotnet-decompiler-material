import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  IconButton,
  Box,
  Typography,
  Divider,
  CircularProgress,
  Breadcrumbs,
  Chip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  ArrowUpward as UpIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  lastModified?: string;
}

interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  directories: FileItem[];
  files: FileItem[];
}

interface FilePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

// Common starting directories
const getQuickPaths = (t: (key: string) => string) => [
  { name: t('home'), path: '/home' },
  { name: t('root'), path: '/' },
  { name: 'usr/lib', path: '/usr/lib' },
  { name: 'opt', path: '/opt' },
];

export default function FilePicker({ open, onClose, onSelect }: FilePickerProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState('/home');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath);
    }
  }, [open, currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    
    try {
      const response = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setListing(data);
        setCurrentPath(data.currentPath);
      }
    } catch (e) {
      setError('Failed to load directory');
    }
    
    setLoading(false);
  };

  const handleNavigate = (item: FileItem) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
    } else {
      setSelectedFile(item);
    }
  };

  const handleGoUp = () => {
    if (listing?.parentPath) {
      setCurrentPath(listing.parentPath);
    }
  };

  const handlePathClick = (path: string) => {
    setCurrentPath(path);
  };

  const handlePathInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      setCurrentPath(target.value);
    }
  };

  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile.path);
      onClose();
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  const quickPaths = getQuickPaths(t);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FileIcon sx={{ color: 'primary.main' }} />
        {t('selectAssembly')}
      </DialogTitle>
      
      <DialogContent sx={{ minWidth: 500 }}>
        {/* Quick paths */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {quickPaths.map((p) => (
            <Chip
              key={p.path}
              label={p.name}
              onClick={() => handlePathClick(p.path)}
              size="small"
              variant="outlined"
              icon={<HomeIcon sx={{ fontSize: 16 }} />}
            />
          ))}
        </Box>

        {/* Path input */}
        <TextField
          fullWidth
          size="small"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={handlePathInput}
          placeholder={t('enterPath')}
          sx={{ mb: 2 }}
        />

        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <IconButton size="small" onClick={handleGoUp} disabled={!listing?.parentPath}>
            <UpIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => loadDirectory(currentPath)}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Breadcrumbs separator="/" sx={{ flex: 1, overflow: 'hidden' }}>
            <Chip
              label="/"
              size="small"
              onClick={() => handlePathClick('/')}
              sx={{ cursor: 'pointer' }}
            />
            {pathParts.map((part, index) => {
              const path = '/' + pathParts.slice(0, index + 1).join('/');
              return (
                <Chip
                  key={path}
                  label={part}
                  size="small"
                  onClick={() => handlePathClick(path)}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
          </Breadcrumbs>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* File list */}
        <Box sx={{ height: 400, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {/* Directories */}
              {listing?.directories?.map((dir) => (
                <ListItemButton
                  key={dir.path}
                  onClick={() => handleNavigate(dir)}
                  onDoubleClick={() => setCurrentPath(dir.path)}
                >
                  <ListItemIcon>
                    <FolderIcon sx={{ color: '#f9a825' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={dir.name}
                    secondary={dir.lastModified ? new Date(dir.lastModified).toLocaleDateString() : undefined}
                  />
                </ListItemButton>
              ))}
              
              {/* Files */}
              {listing?.files?.map((file) => (
                <ListItemButton
                  key={file.path}
                  selected={selectedFile?.path === file.path}
                  onClick={() => handleNavigate(file)}
                >
                  <ListItemIcon>
                    <FileIcon sx={{ color: file.extension === '.dll' ? 'primary.main' : 'secondary.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={file.size ? `${(file.size / 1024).toFixed(1)} KB` : undefined}
                  />
                  <Chip label={file.extension?.toUpperCase()} size="small" />
                </ListItemButton>
              ))}
              
              {listing && listing.directories.length === 0 && listing.files.length === 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                  <Typography color="text.secondary">{t('emptyDirectory')}</Typography>
                </Box>
              )}
            </List>
          )}
        </Box>

        {/* Selected file */}
        {selectedFile && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'primary.main', borderRadius: 2, color: 'primary.contrastText' }}>
            <Typography variant="body2" fontWeight={500}>
              {t('selected')}: {selectedFile.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {selectedFile.path}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={!selectedFile}
        >
          {t('open')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
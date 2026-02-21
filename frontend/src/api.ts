import type { Assembly, TypeInfo, SearchResult, UploadedFile, TreeNode } from './types';

// Use relative path for API - this will work through Vite proxy in development
// and will be served from the same origin in production
const API_BASE = '/api';

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

export async function uploadFiles(files: FileList | File[]): Promise<{ files: UploadedFile[] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function openFilePath(filePath: string): Promise<{ assembly: Assembly }> {
  const response = await fetch(`${API_BASE}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  return response.json();
}

export async function getAssemblies(): Promise<{ assemblies: Assembly[] }> {
  const response = await fetch(`${API_BASE}/assemblies`);
  return response.json();
}

export async function getTypes(assemblyId: string): Promise<{ types: TypeInfo[] }> {
  const response = await fetch(`${API_BASE}/types?assembly=${encodeURIComponent(assemblyId)}`);
  return response.json();
}

export async function decompile(
  assemblyId: string,
  typeName?: string
): Promise<{ code: string }> {
  let url = `${API_BASE}/decompile?assembly=${encodeURIComponent(assemblyId)}`;
  if (typeName) {
    url += `&type=${encodeURIComponent(typeName)}`;
  }
  const response = await fetch(url);
  return response.json();
}

export async function decompileByPath(
  filePath: string,
  typeName?: string
): Promise<{ code: string }> {
  let url = `${API_BASE}/decompile-path?path=${encodeURIComponent(filePath)}`;
  if (typeName) {
    url += `&type=${encodeURIComponent(typeName)}`;
  }
  const response = await fetch(url);
  return response.json();
}

export async function search(
  assemblyId: string,
  query: string
): Promise<{ results: SearchResult[] }> {
  const response = await fetch(
    `${API_BASE}/search?assembly=${encodeURIComponent(assemblyId)}&q=${encodeURIComponent(query)}`
  );
  return response.json();
}

export async function deleteAssembly(assemblyId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/assembly/${encodeURIComponent(assemblyId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete assembly');
  }
}

export async function openInFileManager(assemblyId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/assembly/${encodeURIComponent(assemblyId)}/open-folder`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to open in file manager');
  }
}

export async function exportProject(assemblyId: string): Promise<{ path: string }> {
  const response = await fetch(`${API_BASE}/assembly/${encodeURIComponent(assemblyId)}/export-project`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to export project');
  }
  return response.json();
}

export async function findReferences(
  assemblyId: string,
  typeName: string,
  memberName?: string
): Promise<{ references: Array<{ assembly: string; type: string; member: string; line: number }> }> {
  let url = `${API_BASE}/references?assembly=${encodeURIComponent(assemblyId)}&type=${encodeURIComponent(typeName)}`;
  if (memberName) {
    url += `&member=${encodeURIComponent(memberName)}`;
  }
  const response = await fetch(url);
  return response.json();
}

export async function gotoDefinition(
  assemblyId: string,
  typeName: string,
  memberName?: string
): Promise<{ assemblyId: string; typeName: string; memberName?: string }> {
  let url = `${API_BASE}/definition?assembly=${encodeURIComponent(assemblyId)}&type=${encodeURIComponent(typeName)}`;
  if (memberName) {
    url += `&member=${encodeURIComponent(memberName)}`;
  }
  const response = await fetch(url);
  return response.json();
}


// Build tree from types
export function buildTree(assembly: Assembly, types: TypeInfo[]): TreeNode {
  const root: TreeNode = {
    id: assembly.id,
    name: assembly.name,
    fullName: assembly.name,
    type: 'assembly',
    assemblyId: assembly.id,
    children: [],
  };

  // Group types by namespace
  const namespaceMap = new Map<string, TreeNode>();
  const globalTypes: TreeNode[] = [];

  for (const type of types) {
    const typeNode: TreeNode = {
      id: `${assembly.id}:${type.fullName}`,
      name: type.name,
      fullName: type.fullName,
      type: type.kind as any,
      assemblyId: assembly.id,
      children: type.children?.map(child => ({
        id: `${assembly.id}:${type.fullName}:${child.name}`,
        name: child.name,
        fullName: child.fullName,
        type: child.kind as any,
        assemblyId: assembly.id,
      })) || [],
    };

    if (!type.namespace || type.namespace === '') {
      globalTypes.push(typeNode);
    } else {
      // Split namespace into parts
      const nsParts = type.namespace.split('.');
      let currentPath = '';
      let parentChildren = root.children!;

      for (let i = 0; i < nsParts.length; i++) {
        const nsPart = nsParts[i];
        currentPath = currentPath ? `${currentPath}.${nsPart}` : nsPart;
        const nsId = `${assembly.id}:ns:${currentPath}`;

        let nsNode = namespaceMap.get(nsId);
        if (!nsNode) {
          nsNode = {
            id: nsId,
            name: nsPart,
            fullName: currentPath,
            type: 'namespace',
            assemblyId: assembly.id,
            children: [],
          };
          namespaceMap.set(nsId, nsNode);
          parentChildren.push(nsNode);
        }
        parentChildren = nsNode.children!;
      }

      parentChildren.push(typeNode);
    }
  }

  // Sort: namespaces first, then types (alphabetically within each category)
  const sortChildren = (children: TreeNode[]): TreeNode[] => {
    return children.sort((a, b) => {
      // Namespaces first
      if (a.type === 'namespace' && b.type !== 'namespace') return -1;
      if (a.type !== 'namespace' && b.type === 'namespace') return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    }).map(node => ({
      ...node,
      children: node.children ? sortChildren(node.children) : undefined,
    }));
  };

  root.children = sortChildren(root.children!);
  return root;
}
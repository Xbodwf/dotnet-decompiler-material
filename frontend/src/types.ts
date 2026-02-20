export interface Assembly {
  id: string;
  name: string;
  fileName: string;
  version: string;
  path?: string;
}

export interface TypeInfo {
  name: string;
  fullName: string;
  namespace: string;
  kind: 'class' | 'struct' | 'interface' | 'enum' | 'delegate' | string;
  children: TypeChild[];
}

export interface TypeChild {
  name: string;
  kind: 'method' | 'property' | 'field' | 'event' | 'constructor';
  fullName: string;
}

export interface SearchResult {
  name: string;
  fullName: string;
  kind: string;
  typeName?: string;
  assembly?: string;
  assemblyId?: string;
}

export interface Tab {
  id: string;
  name: string;
  kind: string;
  fullName: string;
  assemblyId?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  path: string;
}

// Tree node types
export type TreeNodeType = 'assembly' | 'namespace' | 'class' | 'struct' | 'interface' | 'enum' | 'delegate' | 'method' | 'property' | 'field' | 'event' | 'constructor';

export interface TreeNode {
  id: string;
  name: string;
  fullName: string;
  type: TreeNodeType;
  children?: TreeNode[];
  assemblyId?: string;
  isExpanded?: boolean;
}
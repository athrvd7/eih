export interface FileEntry {
  path: string;
  language: string;
  size_bytes: number;
  sha256: string;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'ingesting' | 'chunking' | 'embedding' | 'graphing' | 'ready' | 'failed' | 'narrating' | 'scribing';
  repo_id: string;
  repo_name: string;
  error?: string;
  has_graph: boolean;
  has_walkthrough: boolean;
  has_docs: boolean;
  collection_name?: string;
}

export type NodeType = 'entry_point' | 'component' | 'service' | 'utility' | 'config' | 'test';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  language: string;
  summary?: string;
  lines_of_code: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: 'imports' | 'exports' | 'calls';
  imported_symbols: string[];
}

export interface DependencyGraph {
  repo_id: string;
  repo_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_points: string[];
}

export interface NodeDetails {
  node: GraphNode;
  dependencies: string[];
  dependents: string[];
  code_snippet: string;
  file_path: string;
}

export interface WalkthroughStep {
  order: number;
  title: string;
  file_path: string;
  explanation: string;
  code_snippet: string;
  snippet_start_line: number;
  snippet_end_line: number;
  related_files: string[];
  graph_node_ids: string[];
  concepts: string[];
}

export interface Walkthrough {
  repo_id: string;
  repo_name: string;
  total_steps: number;
  steps: WalkthroughStep[];
  generated_at: string;
}

export interface DocSection {
  title: string;
  content: string;
  sources: string[];
}

export interface OnboardingDoc {
  repo_id: string;
  repo_name: string;
  sections: DocSection[];
  generated_at: string;
}

export interface Citation {
  file_path: string;
  start_line: number;
  end_line: number;
  snippet: string;
  chunk_name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  timestamp: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  suggested_followups: string[];
}

export interface SSEEvent {
  stage: string;
  status: 'started' | 'running' | 'complete' | 'failed' | 'done';
  progress?: number;
  message?: string;
  error?: string;
  timestamp?: string;
}

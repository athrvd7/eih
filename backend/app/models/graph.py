from pydantic import BaseModel
from enum import Enum
from typing import Optional


class NodeType(str, Enum):
    ENTRY_POINT = "entry_point"
    COMPONENT = "component"
    SERVICE = "service"
    UTILITY = "utility"
    CONFIG = "config"
    TEST = "test"


class EdgeRelation(str, Enum):
    IMPORTS = "imports"
    EXPORTS = "exports"
    CALLS = "calls"


class GraphNode(BaseModel):
    id: str
    label: str
    type: NodeType
    language: str
    summary: Optional[str] = None
    lines_of_code: int


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: EdgeRelation
    imported_symbols: list[str] = []


class DependencyGraph(BaseModel):
    repo_id: str
    repo_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    entry_points: list[str]

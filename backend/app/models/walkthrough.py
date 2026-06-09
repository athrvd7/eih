from pydantic import BaseModel


class WalkthroughStep(BaseModel):
    order: int
    title: str
    file_path: str
    explanation: str
    code_snippet: str
    snippet_start_line: int
    snippet_end_line: int
    related_files: list[str] = []
    graph_node_ids: list[str] = []
    concepts: list[str] = []


class Walkthrough(BaseModel):
    repo_id: str
    repo_name: str
    total_steps: int
    steps: list[WalkthroughStep]
    generated_at: str

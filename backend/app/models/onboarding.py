from pydantic import BaseModel


class DocSection(BaseModel):
    title: str
    content: str
    sources: list[str] = []


class OnboardingDoc(BaseModel):
    repo_id: str
    repo_name: str
    sections: list[DocSection]
    generated_at: str

"""Story bank schemas."""

from __future__ import annotations

from collections import defaultdict

from pydantic import BaseModel, Field


class StoryStar(BaseModel):
    """Interview-mode delivery (situation/task/action/result)."""

    situation: str
    task: str
    action: str
    result: str


class Story(BaseModel):
    """One entry in the story bank."""

    id: str
    company: str
    title: str
    skills: list[str] = Field(default_factory=list)
    domain: str
    metrics: list[str] = Field(default_factory=list)
    star: StoryStar
    resume_bullet: str
    best_for: list[str] = Field(default_factory=list)

    def to_resume_view(self) -> dict[str, object]:
        """Trimmed projection used as input to compose_resume_content.

        Excludes the verbose `star` and `title` fields to keep token cost low.
        """
        return {
            "id": self.id,
            "company": self.company,
            "skills": self.skills,
            "metrics": self.metrics,
            "resume_bullet": self.resume_bullet,
        }


class StoryBank(BaseModel):
    """The full collection of stories, loaded from `data/story_bank.yaml`."""

    stories: list[Story]

    def by_company(self) -> dict[str, list[Story]]:
        grouped: dict[str, list[Story]] = defaultdict(list)
        for s in self.stories:
            grouped[s.company].append(s)
        return dict(grouped)

    def get(self, story_id: str) -> Story:
        for s in self.stories:
            if s.id == story_id:
                return s
        raise KeyError(f"No story with id {story_id!r}")

    def all_skills(self) -> set[str]:
        return {tag for s in self.stories for tag in s.skills}

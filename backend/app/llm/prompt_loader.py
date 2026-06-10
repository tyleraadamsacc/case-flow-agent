"""Versioned prompt loading (plan §15).

Prompts live in ``app/prompts/caseflow/*.md`` with YAML-ish front matter
(``version``, ``task``, ``output_schema``). The loader indexes by the
front-matter task name; the prompt version is stamped on every model
call and onto ``AgentRun.prompt_version``.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts" / "caseflow"


@dataclass(frozen=True)
class Prompt:
    task: str
    version: str
    output_schema: str
    body: str

    def render(self, context: dict[str, Any]) -> str:
        """Body plus the structured input. No template engine — the
        context travels as labeled JSON so prompts stay reviewable."""
        return (
            f"{self.body.strip()}\n\nINPUT (synthetic data):\n"
            f"{json.dumps(context, default=str, indent=2)}"
        )


class PromptLoaderError(LookupError):
    pass


class PromptLoader:
    def __init__(self, prompts_dir: Path = PROMPTS_DIR) -> None:
        self._prompts: dict[str, Prompt] = {}
        for path in sorted(prompts_dir.glob("*.md")):
            prompt = _parse(path)
            self._prompts[prompt.task] = prompt

    def get(self, task: str) -> Prompt:
        try:
            return self._prompts[task]
        except KeyError as exc:
            raise PromptLoaderError(
                f"No prompt file declares task '{task}' in {PROMPTS_DIR}"
            ) from exc

    @property
    def tasks(self) -> list[str]:
        return sorted(self._prompts)


def _parse(path: Path) -> Prompt:
    text = path.read_text()
    if not text.startswith("---"):
        raise PromptLoaderError(f"{path} is missing front matter")
    _, front, body = text.split("---", 2)
    fields: dict[str, str] = {}
    for line in front.strip().splitlines():
        key, _, value = line.partition(":")
        fields[key.strip()] = value.strip()
    for required in ("version", "task", "output_schema"):
        if not fields.get(required):
            raise PromptLoaderError(f"{path} front matter is missing '{required}'")
    return Prompt(
        task=fields["task"],
        version=fields["version"],
        output_schema=fields["output_schema"],
        body=body,
    )

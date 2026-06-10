"""Local evidence retrieval over the synthetic corpus.

Resolves the stable evidence ids stamped on agent outputs, deficiency
findings, special-handling checks, and audit events into
EvidenceReference objects. Local-only by construction: the corpus is the
packaged mock_data directory. An AgentSearchRetrievalService implements
this same interface in a later PR without touching the agents.
"""

import json
from abc import ABC, abstractmethod
from pathlib import Path

from app.models.enums import EvidenceSourceType
from app.models.evidence import EvidenceReference


class RetrievalService(ABC):
    @abstractmethod
    def get(self, evidence_id: str) -> EvidenceReference | None: ...

    @abstractmethod
    def search(
        self, source_type: EvidenceSourceType | None = None, query: str | None = None
    ) -> list[EvidenceReference]: ...


class LocalSopRetrievalService(RetrievalService):
    def __init__(self, mock_data_dir: Path) -> None:
        self._index: dict[str, EvidenceReference] = {}
        sop_dir = mock_data_dir / "sop"
        registries_dir = mock_data_dir / "registries"

        for entry in json.loads(
            (sop_dir / "request_intake_sop.json").read_text()
        )["sop_entries"]:
            self._add(entry["sop_id"], EvidenceSourceType.SOP, entry["title"], entry["snippet"])

        for rule in json.loads((sop_dir / "routing_rules.json").read_text())["rules"]:
            self._add(
                rule["rule_id"],
                EvidenceSourceType.ROUTING_RULE,
                f"Routing rule {rule['rule_id']} → {rule['queue']}",
                rule["description"],
            )

        for rule in json.loads((sop_dir / "deficiency_rules.json").read_text())["rules"]:
            self._add(
                rule["evidence_id"],
                EvidenceSourceType.DEFICIENCY_RULE,
                f"Deficiency rule: {rule['code']}",
                f"{rule['message']} Suggested resolution: {rule['suggested_resolution']}",
            )

        for rule in json.loads(
            (sop_dir / "special_handling_rules.json").read_text()
        )["rules"]:
            self._add(
                rule["evidence_id"],
                EvidenceSourceType.SPECIAL_HANDLING_RULE,
                f"Special handling rule: {rule['flag']}",
                rule["description"],
            )

        package_rules = json.loads((sop_dir / "response_package_rules.json").read_text())
        for draft_type, evidence_id in package_rules["evidence_ids"].items():
            self._add(
                evidence_id,
                EvidenceSourceType.RESPONSE_TEMPLATE,
                f"Response template: {draft_type}",
                package_rules["header_template"],
            )

        for domain in json.loads(
            (registries_dir / "product_domain_taxonomy.json").read_text()
        )["domains"]:
            self._add(
                domain["domain_id"],
                EvidenceSourceType.TAXONOMY,
                f"Product domain: {domain['name']}",
                domain["description"],
            )

        for party in json.loads(
            (registries_dir / "sensitive_party_registry.json").read_text()
        )["parties"]:
            self._add(
                party["party_id"],
                EvidenceSourceType.REGISTRY,
                f"Sensitive party: {party['name']}",
                party["notes"],
            )

    def _add(
        self, evidence_id: str, source_type: EvidenceSourceType, title: str, snippet: str
    ) -> None:
        self._index[evidence_id] = EvidenceReference(
            evidence_id=evidence_id,
            source_type=source_type,
            title=title,
            snippet=snippet,
        )

    def get(self, evidence_id: str) -> EvidenceReference | None:
        return self._index.get(evidence_id)

    def search(
        self, source_type: EvidenceSourceType | None = None, query: str | None = None
    ) -> list[EvidenceReference]:
        results = list(self._index.values())
        if source_type is not None:
            results = [ref for ref in results if ref.source_type == source_type]
        if query:
            lowered = query.lower()
            results = [
                ref
                for ref in results
                if lowered in ref.title.lower() or lowered in (ref.snippet or "").lower()
            ]
        return sorted(results, key=lambda ref: ref.evidence_id)

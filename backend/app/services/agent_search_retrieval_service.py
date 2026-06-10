"""Vertex AI Search (Agent Search) retrieval — skeleton (plan §16).

Implements the same RetrievalService interface as the local corpus
service, so the swap never touches the agents. Evidence ids map to
document ids in a ``gs://caseflow-grounding/`` data store with the §16
folder layout (sops/, routing-rules/, response-templates/,
deficiency-rules/, product-taxonomy/, training-examples/).

Retrieval/grounding only — Agent Search is never the workflow
orchestrator (doc 04 guardrail). Full wiring is post-MVP.
"""

from app.gcp import GcpAdapterNotReadyError, require_gcp_package, require_setting
from app.models.enums import EvidenceSourceType
from app.models.evidence import EvidenceReference
from app.services.sop_retrieval_service import RetrievalService

_NOT_WIRED = (
    "AgentSearchRetrievalService is a post-MVP skeleton: the data-store "
    "layout is defined, but live Vertex AI Search wiring is not enabled "
    "in the prototype."
)


class AgentSearchRetrievalService(RetrievalService):
    def __init__(self, *, datastore: str | None) -> None:
        require_gcp_package("google.cloud.discoveryengine")
        self._datastore = require_setting(datastore, "CASEFLOW_AGENT_SEARCH_DATASTORE")

    def get(self, evidence_id: str) -> EvidenceReference | None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def search(
        self, source_type: EvidenceSourceType | None = None, query: str | None = None
    ) -> list[EvidenceReference]:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

export type RelatedStory = {
  id?: number;
  feedId?: number;
  title: string;
  link: string;
  description?: string | null;
};

const ignoredTerms = new Set(["about", "after", "again", "also", "amid", "and", "are", "around", "article", "been", "before", "being", "between", "but", "can", "from", "have", "into", "just", "more", "news", "not", "our", "over", "story", "that", "the", "their", "this", "update", "was", "what", "when", "with", "will", "you"]);

function terms(value: string | null | undefined) {
  return new Set((value ?? "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g)?.filter((term) => !ignoredTerms.has(term)) ?? []);
}

export function findRelatedStories(target: RelatedStory, candidates: RelatedStory[], limit = 6) {
  const targetTitleTerms = terms(target.title);
  const targetTerms = new Set([...Array.from(targetTitleTerms), ...Array.from(terms(target.description))]);
  return candidates.map((candidate) => {
    if (candidate.link === target.link) return { candidate, score: 0 };
    const candidateTitleTerms = terms(candidate.title);
    const candidateTerms = new Set([...Array.from(candidateTitleTerms), ...Array.from(terms(candidate.description))]);
    const shared = Array.from(targetTerms).filter((term) => candidateTerms.has(term));
    const titleShared = shared.filter((term) => targetTitleTerms.has(term) && candidateTitleTerms.has(term));
    return { candidate, score: shared.length + titleShared.length * 2 };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title)).slice(0, limit).map((item) => item.candidate);
}

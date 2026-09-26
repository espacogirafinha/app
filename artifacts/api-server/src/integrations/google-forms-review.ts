type ReviewRow = {
  id: string;
  submittedAt: Date;
  status: string;
  errorMessage: string | null;
  venueEventId: string | null;
};

export function formatReviewImport(row: ReviewRow) {
  return {
    id: row.id,
    submittedAt: row.submittedAt.toISOString(),
    status: row.status,
    reasons: row.errorMessage ? row.errorMessage.split("; ") : [],
    venueEventId: row.venueEventId,
  };
}

interface PageStatusBadgeProps {
  published: boolean;
  deletedAt?: string | null;
}

export function PageStatusBadge({
  published,
  deletedAt,
}: PageStatusBadgeProps) {
  if (deletedAt) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
        Deleted
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        published
          ? "bg-green-100 text-green-800"
          : "bg-yellow-100 text-yellow-800"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

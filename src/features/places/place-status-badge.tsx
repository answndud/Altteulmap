type PlaceStatusBadgeProps = {
  verified: boolean;
};

export function PlaceStatusBadge({ verified }: PlaceStatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        verified
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {verified ? "검증됨" : "미검증"}
    </span>
  );
}

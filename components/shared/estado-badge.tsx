import { Badge } from "@/components/ui/badge";
import { EstadoItem } from "@/types/database";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants/items";

interface EstadoBadgeProps {
  estado: EstadoItem;
  className?: string;
}

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  return (
    <Badge variant={ESTADO_COLORS[estado] as Parameters<typeof Badge>[0]["variant"]} className={className}>
      {ESTADO_LABELS[estado]}
    </Badge>
  );
}

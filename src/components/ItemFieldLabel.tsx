import { Label } from "@/components/ui/label";
import type { EditableItemDTO } from "@/types";

// 項目の金額欄のラベル。編集画面で、無効・適用範囲外・削除済みの項目には理由を添える（#211）
export function ItemFieldLabel({ item }: { item: EditableItemDTO }) {
  return (
    <Label htmlFor={`custom-${item.id}`}>
      {item.itemName}
      {item.statusNote && (
        <span className="text-xs font-normal text-muted-foreground">{item.statusNote}</span>
      )}
    </Label>
  );
}

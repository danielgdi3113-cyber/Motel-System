"use client";

import { PackagePlus, Pencil, Plus } from "lucide-react";
import { saveProductAction, stockMovementAction } from "@/actions/products";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Checkbox, Input, Select } from "@/components/ui";
import { centsToInput } from "@/lib/money";

type Product = { id: string; name: string; category: string; price: number; cost: number; minStock: number; active: boolean };

export function ProductForm({ product, categories }: { product?: Product; categories: string[] }) {
  return (
    <Modal
      title={product ? "Editar produto" : "Novo produto"}
      trigger={(open) =>
        product ? (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" /> Novo produto
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveProductAction} onSuccess={close} resetOnSuccess={!product}>
          <input type="hidden" name="id" value={product?.id ?? ""} />
          <Input label="Nome" name="name" defaultValue={product?.name} required />
          <Input label="Categoria" name="category" list="product-categories" defaultValue={product?.category ?? "Bebidas"} required />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Preço" name="price" inputMode="decimal" defaultValue={product ? centsToInput(product.price) : ""} required />
            <Input label="Custo" name="cost" inputMode="decimal" defaultValue={product ? centsToInput(product.cost) : ""} />
            <Input label="Estoque mín." name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 5} />
          </div>
          <Checkbox name="active" label="Disponível para venda" defaultChecked={product?.active ?? true} />
          {!product && <p className="text-xs text-muted">O estoque inicial é lançado em “Movimentar estoque”.</p>}
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function StockForm({ products, isAdmin }: { products: { id: string; name: string; stock: number }[]; isAdmin: boolean }) {
  return (
    <Modal
      title="Movimentar estoque"
      trigger={(open) => (
        <Button variant="secondary" onClick={open}>
          <PackagePlus className="size-4" /> Movimentar estoque
        </Button>
      )}
    >
      {() => (
        <ActionForm action={stockMovementAction} resetOnSuccess>
          <Select label="Produto" name="productId" required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (atual: {p.stock})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" name="type" defaultValue="ENTRADA">
              <option value="ENTRADA">Entrada (compra)</option>
              {isAdmin && <option value="AJUSTE">Ajuste (+/−)</option>}
            </Select>
            <Input label="Quantidade" name="quantity" type="number" required />
          </div>
          <Input label="Motivo / nota fiscal" name="reason" placeholder="Opcional" />
          <Submit className="w-full">Lançar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

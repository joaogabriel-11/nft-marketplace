import { useNavigate } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import searchIcon from "@/assets/icons/search.svg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Lupa do header: abre a busca e leva ao catálogo com ?q= (busca compõe o estado da URL). */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const inputId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    void navigate({ to: "/", search: (prev) => ({ ...prev, q: value.trim() || undefined, page: undefined }), hash: "catalogo" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="grid size-8 place-items-center rounded-full" aria-label="Buscar NFTs">
        <img src={searchIcon} alt="" width={20} height={20} />
      </DialogTrigger>
      <DialogContent className="top-24 translate-y-0 rounded-[8px] p-8">
        <DialogTitle className="text-20 font-medium text-text-accent">Buscar NFTs</DialogTitle>
        <DialogDescription className="mt-2 text-13 text-text-secondary">
          Procure por nome do NFT ou da coleção.
        </DialogDescription>
        <form onSubmit={submit} role="search" className="mt-6 flex gap-3">
          <label htmlFor={inputId} className="sr-only">
            Termo de busca
          </label>
          <Input
            id={inputId}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ex.: Emerald Ape"
            autoComplete="off"
            maxLength={80}
          />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

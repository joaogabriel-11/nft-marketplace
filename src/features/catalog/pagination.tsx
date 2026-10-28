import arrowRight from "@/assets/icons/arrow-right2.svg";
import { cn } from "@/lib/utils";

const PAGE = "grid size-[35px] place-items-center rounded-[4px] text-18 leading-4";

/** Janela de até 5 páginas ao redor da atual. */
function pageWindow(page: number, totalPages: number) {
  const size = Math.min(5, totalPages);
  const start = Math.min(Math.max(1, page - 2), totalPages - size + 1);
  return Array.from({ length: size }, (_, index) => start + index);
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginação do catálogo">
      <ul className="flex items-center gap-2">
        <li>
          <button
            type="button"
            className={cn(PAGE, "border border-border disabled:opacity-40")}
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <img src={arrowRight} alt="" width={12} height={7} className="rotate-90" />
          </button>
        </li>
        {pageWindow(page, totalPages).map((number) => (
          <li key={number}>
            <button
              type="button"
              aria-label={`Página ${number}`}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onChange(number)}
              className={cn(PAGE, number === page ? "bg-primary font-bold text-ink" : "border border-border hover:border-primary")}
            >
              {number}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={cn(PAGE, "border border-border disabled:opacity-40")}
            aria-label="Próxima página"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            <img src={arrowRight} alt="" width={12} height={7} className="-rotate-90" />
          </button>
        </li>
      </ul>
    </nav>
  );
}

import { Mail, Globe, Phone } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-border/60 px-4 py-8 text-sm text-muted-foreground sm:px-6 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Memskool</span>
        </div>
        <p className="font-display text-sm font-semibold tracking-tight text-foreground">
          Memskool is a product of Mem-Industries in Partnership with Altrastate Technologies Ltd
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
              Mem-Industries
            </p>
            <a
              href="mailto:memskool@gmail.com"
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Mail className="size-3.5" aria-hidden /> memskool@gmail.com
            </a>
            <a
              href="https://mem.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Globe className="size-3.5" aria-hidden /> mem.com
            </a>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
              Altrastate Technologies Ltd
            </p>
            <a
              href="mailto:altrastate@gmail.com"
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Mail className="size-3.5" aria-hidden /> altrastate@gmail.com
            </a>
            <a
              href="https://altrastate.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Globe className="size-3.5" aria-hidden /> altrastate.com
            </a>
            <a
              href="tel:+256765179900"
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Phone className="size-3.5" aria-hidden /> +256 765 179 900
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/80">
          © {new Date().getFullYear()} Mem-Industries. Built by Altrastate Technologies Ltd. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
}

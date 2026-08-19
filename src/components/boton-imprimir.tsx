"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotonImprimir({ texto = "Imprimir" }: { texto?: string }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer />
      {texto}
    </Button>
  );
}

"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotonImprimir() {
  return (
    <Button onClick={() => window.print()}>
      <Printer />
      Imprimir
    </Button>
  );
}

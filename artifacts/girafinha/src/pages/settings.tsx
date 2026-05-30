import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-muted p-2 text-muted-foreground">
            <Settings className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Definições</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
          Configuração de packs, serviços, extras, templates de mensagens e preferências internas da app.
        </p>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Área de configuração</CardTitle>
          <CardDescription>Esta página fica preparada para a Fase 2+ da V2.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nesta fase ainda não existem formulários de definições. A navegação já está pronta para receber catálogos de packs,
            serviços externos, extras, checklists e templates de WhatsApp.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { MessageCircle, ShieldOff } from 'lucide-react'
import { useParams } from 'react-router'

import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { ConversaView } from './ConversaView'
import { ListaConversas } from './ListaConversas'
import { podeUsarCrm } from './regras'

/**
 * Central de atendimento do WhatsApp.
 * Computador: lista à esquerda e conversa à direita. Celular: a lista é a página e a
 * conversa abre por cima, ocupando a tela (como no WhatsApp).
 */
export function CrmPage() {
  const { conversaId } = useParams()
  const perfil = usePerfil()

  if (!podeUsarCrm(perfil)) {
    return (
      <Card className="py-12 text-center">
        <ShieldOff className="mx-auto mb-3 size-10 text-texto-suave" aria-hidden />
        <h1 className="text-lg font-bold">Sem acesso ao atendimento</h1>
        <p className="mt-2 text-texto-suave">
          Peça ao administrador para ligar a permissão “atende WhatsApp” no seu usuário.
        </p>
      </Card>
    )
  }

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:mx-0 lg:mt-0 lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-borda lg:bg-white">
      <section
        aria-label="Conversas"
        className={cn(
          'flex flex-col lg:min-h-0 lg:border-r lg:border-borda',
          conversaId && 'hidden lg:flex',
        )}
      >
        <ListaConversas />
      </section>
      <section
        aria-label="Conversa"
        className={cn(
          'flex-col',
          conversaId
            ? 'fixed inset-0 z-30 flex bg-fundo-suave lg:static lg:z-auto lg:min-h-0'
            : 'hidden lg:flex',
        )}
      >
        {conversaId ? (
          <ConversaView key={conversaId} conversaId={conversaId} />
        ) : (
          <div className="grid flex-1 place-items-center bg-fundo-suave p-8 text-center text-texto-suave">
            <div>
              <MessageCircle className="mx-auto mb-3 size-12" aria-hidden />
              <p>Escolha uma conversa à esquerda.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

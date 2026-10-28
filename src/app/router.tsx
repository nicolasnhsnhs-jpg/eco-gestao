import { createBrowserRouter } from 'react-router'

import { EmBreve } from '@/components/EmBreve'
import { InicioPage } from '@/features/inicio/InicioPage'

import { AppLayout } from './AppLayout'
import { NaoEncontradaPage } from './NaoEncontradaPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <InicioPage /> },
      {
        path: 'clientes',
        element: (
          <EmBreve
            titulo="Clientes"
            fase={1}
            descricao="Cadastro de clientes pessoa física e jurídica, busca rápida e a ficha completa de cada cliente."
          />
        ),
      },
      {
        path: 'financeiro',
        element: (
          <EmBreve
            titulo="Financeiro"
            fase={2}
            descricao="Contas a pagar e a receber, confirmação de pagamentos, atrasados e fluxo de caixa."
          />
        ),
      },
      {
        path: 'propostas',
        element: (
          <EmBreve
            titulo="Propostas"
            fase={3}
            descricao="Arquivos de propostas ligados a cada cliente, com valor, prazo e situação."
          />
        ),
      },
      {
        path: 'servicos',
        element: (
          <EmBreve
            titulo="Serviços"
            fase={4}
            descricao="Serviços realizados, certificados, fotos de antes e depois, e os próximos vencimentos."
          />
        ),
      },
      {
        path: 'contratos',
        element: (
          <EmBreve
            titulo="Contratos"
            fase={5}
            descricao="Contratos com mensalidade, cobrança automática e comissões dos vendedores."
          />
        ),
      },
      {
        path: 'avisos',
        element: (
          <EmBreve
            titulo="Avisos"
            fase={2}
            descricao="Cobranças atrasadas, serviços vencendo e outros lembretes num lugar só."
          />
        ),
      },
      {
        path: 'usuarios',
        element: (
          <EmBreve
            titulo="Usuários"
            fase={1}
            descricao="Convidar pessoas da equipe, definir o perfil de cada uma e desativar acessos."
          />
        ),
      },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])

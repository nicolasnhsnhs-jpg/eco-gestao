import { createBrowserRouter } from 'react-router'

import { EmBreve } from '@/components/EmBreve'
import { AvisosPage } from '@/features/avisos/AvisosPage'
import { DefinirSenhaPage } from '@/features/auth/DefinirSenhaPage'
import { EntrarPage } from '@/features/auth/EntrarPage'
import { EsqueciSenhaPage } from '@/features/auth/EsqueciSenhaPage'
import { ExigePapel, RotaProtegida } from '@/features/auth/RotaProtegida'
import { ClienteFichaPage } from '@/features/clientes/ClienteFichaPage'
import { ClienteFormPage } from '@/features/clientes/ClienteFormPage'
import { ClientesPage } from '@/features/clientes/ClientesPage'
import { CadastrosPage } from '@/features/financeiro/CadastrosPage'
import { FinanceiroLayout } from '@/features/financeiro/FinanceiroLayout'
import { LancamentoFormPage } from '@/features/financeiro/LancamentoFormPage'
import { LancamentosPage } from '@/features/financeiro/LancamentosPage'
import { PainelPage } from '@/features/financeiro/PainelPage'
import { InicioPage } from '@/features/inicio/InicioPage'
import { UsuariosPage } from '@/features/usuarios/UsuariosPage'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { AppLayout } from './AppLayout'
import { ErroPage } from './ErroPage'
import { NaoEncontradaPage } from './NaoEncontradaPage'

export const router = createBrowserRouter([
  // Telas sem login
  { path: '/entrar', element: <EntrarPage /> },
  { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
  { path: '/definir-senha', element: <DefinirSenhaPage /> },

  // Telas do sistema (exigem login)
  {
    element: (
      <RotaProtegida>
        <AppLayout />
      </RotaProtegida>
    ),
    errorElement: <ErroPage />,
    children: [
      { index: true, element: <InicioPage /> },
      { path: 'clientes', element: <ClientesPage /> },
      { path: 'clientes/novo', element: <ClienteFormPage /> },
      { path: 'clientes/:id', element: <ClienteFichaPage /> },
      { path: 'clientes/:id/editar', element: <ClienteFormPage /> },
      {
        path: 'usuarios',
        element: (
          <ExigePapel papeis={['admin']}>
            <UsuariosPage />
          </ExigePapel>
        ),
      },
      {
        path: 'financeiro',
        element: (
          <ExigePapel papeis={PAPEIS_ACESSO_TOTAL}>
            <FinanceiroLayout />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <PainelPage /> },
          { path: 'lancamentos', element: <LancamentosPage /> },
          { path: 'lancamentos/novo', element: <LancamentoFormPage /> },
          { path: 'lancamentos/:id', element: <LancamentoFormPage /> },
          { path: 'cadastros', element: <CadastrosPage /> },
        ],
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
      { path: 'avisos', element: <AvisosPage /> },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])

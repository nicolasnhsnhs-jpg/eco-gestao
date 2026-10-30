import { createBrowserRouter, Outlet } from 'react-router'

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
import { PropostaFormPage } from '@/features/propostas/PropostaFormPage'
import { PropostaPage } from '@/features/propostas/PropostaPage'
import { PropostasPage } from '@/features/propostas/PropostasPage'
import { ServicoFormPage } from '@/features/servicos/ServicoFormPage'
import { ServicoPage } from '@/features/servicos/ServicoPage'
import {
  AgendaPage,
  ServicosLayout,
  TiposServicoPage,
  VencimentosPage,
} from '@/features/servicos/ServicosPages'
import { ContratoFormPage } from '@/features/contratos/ContratoFormPage'
import { ContratoPage, ContratosPage } from '@/features/contratos/ContratosPages'
import { ComissoesPage } from '@/features/financeiro/ComissoesPage'
import { MinhasComissoesPage } from '@/features/financeiro/MinhasComissoesPage'
import { InicioPage } from '@/features/inicio/InicioPage'
import { ExecucaoPage } from '@/features/os/operador/ExecucaoPage'
import { OsFormPage } from '@/features/os/OsFormPage'
import { OsListaPage } from '@/features/os/OsListaPage'
import { OsPage } from '@/features/os/OsPage'
import { UsuariosPage } from '@/features/usuarios/UsuariosPage'
import { PAPEIS, PAPEIS_ACESSO_TOTAL, PAPEIS_ESCRITORIO_OS } from '@/lib/papeis'

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
      {
        path: 'clientes',
        element: (
          <ExigePapel papeis={PAPEIS.filter((p) => p !== 'operador')}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <ClientesPage /> },
          { path: 'novo', element: <ClienteFormPage /> },
          { path: ':id', element: <ClienteFichaPage /> },
          { path: ':id/editar', element: <ClienteFormPage /> },
        ],
      },
      {
        path: 'os',
        children: [
          {
            index: true,
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <OsListaPage />
              </ExigePapel>
            ),
          },
          {
            path: 'nova',
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <OsFormPage />
              </ExigePapel>
            ),
          },
          {
            path: ':id',
            element: (
              <ExigePapel papeis={PAPEIS.filter((p) => p !== 'operador')}>
                <OsPage />
              </ExigePapel>
            ),
          },
          {
            path: ':id/executar',
            element: (
              <ExigePapel papeis={['operador', 'admin']}>
                <ExecucaoPage />
              </ExigePapel>
            ),
          },
        ],
      },
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
          { path: 'comissoes', element: <ComissoesPage /> },
          { path: 'cadastros', element: <CadastrosPage /> },
        ],
      },
      {
        path: 'propostas',
        element: (
          <ExigePapel papeis={['admin', 'financeiro', 'vendedor']}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <PropostasPage /> },
          { path: 'nova', element: <PropostaFormPage /> },
          { path: ':id', element: <PropostaPage /> },
          { path: ':id/editar', element: <PropostaFormPage /> },
        ],
      },
      {
        path: 'servicos',
        element: (
          <ExigePapel papeis={['admin', 'financeiro', 'vendedor']}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          {
            element: <ServicosLayout />,
            children: [
              { index: true, element: <AgendaPage /> },
              { path: 'vencimentos', element: <VencimentosPage /> },
              {
                path: 'tipos',
                element: (
                  <ExigePapel papeis={PAPEIS_ACESSO_TOTAL}>
                    <TiposServicoPage />
                  </ExigePapel>
                ),
              },
            ],
          },
          { path: 'novo', element: <ServicoFormPage /> },
          { path: ':id', element: <ServicoPage /> },
          { path: ':id/editar', element: <ServicoFormPage /> },
        ],
      },
      {
        path: 'contratos',
        element: (
          <ExigePapel papeis={['admin', 'financeiro', 'vendedor']}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <ContratosPage /> },
          { path: 'novo', element: <ContratoFormPage /> },
          { path: ':id', element: <ContratoPage /> },
          { path: ':id/editar', element: <ContratoFormPage /> },
        ],
      },
      {
        path: 'comissoes',
        element: (
          <ExigePapel papeis={['vendedor']}>
            <MinhasComissoesPage />
          </ExigePapel>
        ),
      },
      { path: 'avisos', element: <AvisosPage /> },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])

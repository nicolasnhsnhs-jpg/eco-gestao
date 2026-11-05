import { createBrowserRouter, Navigate, Outlet } from 'react-router'

import { AdministrativoLayout } from '@/features/administrativo/AdministrativoLayout'
import { AssinaturaPage } from '@/features/administrativo/assinatura/AssinaturaPage'
import { AvisosPage } from '@/features/avisos/AvisosPage'
import { DefinirSenhaPage } from '@/features/auth/DefinirSenhaPage'
import { EntrarPage } from '@/features/auth/EntrarPage'
import { EsqueciSenhaPage } from '@/features/auth/EsqueciSenhaPage'
import { ExigePapel, RotaProtegida } from '@/features/auth/RotaProtegida'
import { ClienteFichaPage } from '@/features/clientes/ClienteFichaPage'
import { ClienteFormPage } from '@/features/clientes/ClienteFormPage'
import { ClientesPage } from '@/features/clientes/ClientesPage'
import { AntecipacoesPage } from '@/features/financeiro/AntecipacoesPage'
import { CadastrosPage } from '@/features/financeiro/CadastrosPage'
import { CartoesPage } from '@/features/financeiro/CartoesPage'
import { ContasFixasPage } from '@/features/financeiro/ContasFixasPage'
import { FinanceiroLayout } from '@/features/financeiro/FinanceiroLayout'
import { InvestimentosPage } from '@/features/financeiro/InvestimentosPage'
import { LancamentoFormPage } from '@/features/financeiro/LancamentoFormPage'
import { LancamentosPage } from '@/features/financeiro/LancamentosPage'
import { NotaFiscalFormPage } from '@/features/financeiro/NotaFiscalFormPage'
import { NotasFiscaisPage } from '@/features/financeiro/NotasFiscaisPage'
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
import { CalculadoraPage } from '@/features/orcamentos/CalculadoraPage'
import { CustosPage } from '@/features/orcamentos/CustosPage'
import { OrcamentosLayout } from '@/features/orcamentos/OrcamentosLayout'
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
          { path: 'antecipacoes', element: <AntecipacoesPage /> },
          { path: 'notas', element: <NotasFiscaisPage /> },
          { path: 'notas/nova', element: <NotaFiscalFormPage /> },
          { path: 'notas/:id', element: <NotaFiscalFormPage /> },
          { path: 'contas-fixas', element: <ContasFixasPage /> },
          { path: 'investimentos', element: <InvestimentosPage /> },
          { path: 'cartoes', element: <CartoesPage /> },
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
        path: 'orcamentos',
        element: (
          <ExigePapel papeis={['admin', 'vendedor']}>
            <OrcamentosLayout />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <CalculadoraPage /> },
          {
            path: 'custos',
            element: (
              <ExigePapel papeis={['admin']}>
                <CustosPage />
              </ExigePapel>
            ),
          },
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
      {
        path: 'administrativo',
        element: (
          <ExigePapel papeis={PAPEIS_ACESSO_TOTAL}>
            <AdministrativoLayout />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <Navigate to="assinatura" replace /> },
          { path: 'assinatura', element: <AssinaturaPage /> },
        ],
      },
      { path: 'avisos', element: <AvisosPage /> },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])

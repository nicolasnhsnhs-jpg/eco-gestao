import { createBrowserRouter, Navigate, Outlet } from 'react-router'

import { AgendaDiaPage } from '@/features/agenda/AgendaDiaPage'
import { PresencaPage } from '@/features/agenda/PresencaPage'
import { AgendaTvPage } from '@/features/agenda/AgendaTvPage'
import { AdministrativoLayout } from '@/features/administrativo/AdministrativoLayout'
import { AssinaturaPage } from '@/features/administrativo/assinatura/AssinaturaPage'
import { AvisosPage } from '@/features/avisos/AvisosPage'
import { CrmPage } from '@/features/crm/CrmPage'
import { NotificacoesPage } from '@/features/crm/NotificacoesPage'
import { CadastroPage } from '@/features/auth/CadastroPage'
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
import { PropostasAgendadasPage } from '@/features/propostas/PropostasAgendadasPage'
import { PropostasLayout, PropostasPage } from '@/features/propostas/PropostasPage'
import { ServicoFormPage } from '@/features/servicos/ServicoFormPage'
import { ServicoPage } from '@/features/servicos/ServicoPage'
import {
  AgendaPage,
  ServicosLayout,
  TiposServicoPage,
  VencimentosPage,
} from '@/features/servicos/ServicosPages'
import { DescricaoContratoFormPage } from '@/features/clientes/DescricaoContratoFormPage'
import { ContratoFormPage } from '@/features/contratos/ContratoFormPage'
import { ContratoPage, ContratosPage } from '@/features/contratos/ContratosPages'
import { ComissoesPage } from '@/features/financeiro/ComissoesPage'
import { MinhasComissoesPage } from '@/features/financeiro/MinhasComissoesPage'
import { InicioPage } from '@/features/inicio/InicioPage'
import { ExecucaoPage } from '@/features/os/operador/ExecucaoPage'
import { OsFormPage } from '@/features/os/OsFormPage'
import { OsListaPage } from '@/features/os/OsListaPage'
import { TreinamentoOsPage } from '@/features/os/TreinamentoOsPage'
import { OsPage } from '@/features/os/OsPage'
import { ModeloNovoPage, ModeloOsPage, ModelosOsPage } from '@/features/os/ModelosOsPages'
import { RotaPage } from '@/features/os/RotasPages'
import { CalculadoraPage } from '@/features/orcamentos/CalculadoraPage'
import { CustosPage } from '@/features/orcamentos/CustosPage'
import { OrcamentosLayout } from '@/features/orcamentos/OrcamentosLayout'
import { UsuariosPage } from '@/features/usuarios/UsuariosPage'
import { AssinaturasCertificadoPage } from '@/features/certificados/AssinaturasCertificadoPage'
import { CertificadoFormPage } from '@/features/certificados/CertificadoFormPage'
import { CertificadosPage } from '@/features/certificados/CertificadosPage'
import { ProdutosCertificadoPage } from '@/features/certificados/ProdutosCertificadoPage'
import {
  PAPEIS,
  PAPEIS_ACESSO_TOTAL,
  PAPEIS_CERTIFICADOS,
  PAPEIS_ESCRITORIO_OS,
  PAPEIS_GESTAO,
  PAPEIS_VER_CERTIFICADOS,
} from '@/lib/papeis'

import { AppLayout } from './AppLayout'
import { ErroPage } from './ErroPage'
import { NaoEncontradaPage } from './NaoEncontradaPage'

/** Quem trabalha com propostas, serviços e contratos. */
const COMERCIAL = [...PAPEIS_GESTAO, 'vendedor' as const]

export const router = createBrowserRouter([
  // Telas sem login
  { path: '/entrar', element: <EntrarPage /> },
  { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
  { path: '/definir-senha', element: <DefinirSenhaPage /> },
  // Link de cadastro que o admin manda no grupo; a conta só entra depois de aprovada.
  { path: '/cadastro/:codigo', element: <CadastroPage /> },

  // Agenda do dia na TV: tela cheia, sem o menu do sistema.
  {
    path: '/agenda-tv',
    element: (
      <RotaProtegida>
        <ExigePapel papeis={COMERCIAL}>
          <AgendaTvPage />
        </ExigePapel>
      </RotaProtegida>
    ),
    errorElement: <ErroPage />,
  },

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
      // Atendimento pelo WhatsApp. Quem pode entrar é decidido na própria página (permissão no perfil).
      { path: 'crm', element: <CrmPage /> },
      { path: 'crm/notificacoes', element: <NotificacoesPage /> },
      { path: 'crm/:conversaId', element: <CrmPage /> },
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
          { path: ':id/descricao-contrato', element: <DescricaoContratoFormPage /> },
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
            path: 'treinamento',
            element: (
              <ExigePapel papeis={PAPEIS_GESTAO}>
                <TreinamentoOsPage />
              </ExigePapel>
            ),
          },
          {
            path: 'modelos',
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <ModelosOsPage />
              </ExigePapel>
            ),
          },
          {
            path: 'modelos/novo',
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <ModeloNovoPage />
              </ExigePapel>
            ),
          },
          {
            path: 'rotas/:id',
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <RotaPage />
              </ExigePapel>
            ),
          },
          {
            path: 'modelos/:id',
            element: (
              <ExigePapel papeis={PAPEIS_ESCRITORIO_OS}>
                <ModeloOsPage />
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
      // O operador só olha a agenda do dia (sem as outras abas de Serviços).
      {
        path: 'agenda-do-dia',
        element: (
          <ExigePapel papeis={['operador']}>
            <AgendaDiaPage />
          </ExigePapel>
        ),
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
          <ExigePapel papeis={COMERCIAL}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          {
            element: <PropostasLayout />,
            children: [
              { index: true, element: <PropostasPage /> },
              { path: 'agendadas', element: <PropostasAgendadasPage /> },
              { path: 'nova', element: <PropostaFormPage /> },
            ],
          },
          { path: ':id', element: <PropostaPage /> },
          { path: ':id/editar', element: <PropostaFormPage /> },
        ],
      },
      {
        path: 'servicos',
        element: (
          <ExigePapel papeis={COMERCIAL}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          {
            element: <ServicosLayout />,
            children: [
              { index: true, element: <AgendaPage /> },
              { path: 'dia', element: <AgendaDiaPage /> },
              { path: 'presenca', element: <PresencaPage /> },
              { path: 'vencimentos', element: <VencimentosPage /> },
              {
                path: 'tipos',
                element: (
                  <ExigePapel papeis={PAPEIS_GESTAO}>
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
          <ExigePapel papeis={COMERCIAL}>
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
          <ExigePapel papeis={['admin', 'administrativo', 'vendedor']}>
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
          <ExigePapel papeis={PAPEIS_GESTAO}>
            <AdministrativoLayout />
          </ExigePapel>
        ),
        children: [
          { index: true, element: <Navigate to="assinatura" replace /> },
          { path: 'assinatura', element: <AssinaturaPage /> },
        ],
      },
      {
        path: 'certificados',
        element: (
          <ExigePapel papeis={PAPEIS_VER_CERTIFICADOS}>
            <Outlet />
          </ExigePapel>
        ),
        children: [
          // O vendedor só vê a lista e baixa o PDF; o resto é de quem emite.
          { index: true, element: <CertificadosPage /> },
          {
            element: (
              <ExigePapel papeis={PAPEIS_CERTIFICADOS}>
                <Outlet />
              </ExigePapel>
            ),
            children: [
              { path: 'novo', element: <CertificadoFormPage /> },
              { path: 'produtos', element: <ProdutosCertificadoPage /> },
              { path: 'assinaturas', element: <AssinaturasCertificadoPage /> },
              { path: ':id', element: <CertificadoFormPage /> },
            ],
          },
        ],
      },
      { path: 'avisos', element: <AvisosPage /> },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
])

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      arquivos: {
        Row: {
          caminho_storage: string
          categoria: Database['public']['Enums']['categoria_arquivo']
          cliente_id: string
          criado_em: string
          descricao: string | null
          enviado_por: string
          id: string
          lancamento_id: string | null
          nome_original: string
          os_id: string | null
          proposta_id: string | null
          servico_id: string | null
          tamanho_bytes: number | null
          tipo_mime: string | null
        }
        Insert: {
          caminho_storage: string
          categoria?: Database['public']['Enums']['categoria_arquivo']
          cliente_id: string
          criado_em?: string
          descricao?: string | null
          enviado_por?: string
          id?: string
          lancamento_id?: string | null
          nome_original: string
          os_id?: string | null
          proposta_id?: string | null
          servico_id?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Update: {
          caminho_storage?: string
          categoria?: Database['public']['Enums']['categoria_arquivo']
          cliente_id?: string
          criado_em?: string
          descricao?: string | null
          enviado_por?: string
          id?: string
          lancamento_id?: string | null
          nome_original?: string
          os_id?: string | null
          proposta_id?: string | null
          servico_id?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'arquivos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_enviado_por_fkey'
            columns: ['enviado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_movimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'v_propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'arquivos_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
        ]
      }
      atendimentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          canal: Database['public']['Enums']['canal_atendimento']
          cliente_id: string
          criado_em: string
          criado_por: string | null
          data_hora: string
          id: string
          resumo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          canal: Database['public']['Enums']['canal_atendimento']
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          id?: string
          resumo: string
          usuario_id?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          canal?: Database['public']['Enums']['canal_atendimento']
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          id?: string
          resumo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'atendimentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'atendimentos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'atendimentos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'atendimentos_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          cliente_id: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          em: string
          id: number
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          cliente_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          cliente_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      avisos: {
        Row: {
          chave_unica: string
          criado_em: string
          destinatario_id: string | null
          id: string
          lancamento_id: string | null
          lido_em: string | null
          link: string | null
          mensagem: string | null
          papel_destino: Database['public']['Enums']['papel'] | null
          proposta_id: string | null
          resolvido_em: string | null
          servico_id: string | null
          tipo: string
          titulo: string
          vencimento_id: string | null
        }
        Insert: {
          chave_unica: string
          criado_em?: string
          destinatario_id?: string | null
          id?: string
          lancamento_id?: string | null
          lido_em?: string | null
          link?: string | null
          mensagem?: string | null
          papel_destino?: Database['public']['Enums']['papel'] | null
          proposta_id?: string | null
          resolvido_em?: string | null
          servico_id?: string | null
          tipo: string
          titulo: string
          vencimento_id?: string | null
        }
        Update: {
          chave_unica?: string
          criado_em?: string
          destinatario_id?: string | null
          id?: string
          lancamento_id?: string | null
          lido_em?: string | null
          link?: string | null
          mensagem?: string | null
          papel_destino?: Database['public']['Enums']['papel'] | null
          proposta_id?: string | null
          resolvido_em?: string | null
          servico_id?: string | null
          tipo?: string
          titulo?: string
          vencimento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'avisos_destinatario_id_fkey'
            columns: ['destinatario_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_movimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'v_propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_vencimento_id_fkey'
            columns: ['vencimento_id']
            isOneToOne: false
            referencedRelation: 'v_vencimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avisos_vencimento_id_fkey'
            columns: ['vencimento_id']
            isOneToOne: false
            referencedRelation: 'vencimentos_servico'
            referencedColumns: ['id']
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          tipo: Database['public']['Enums']['tipo_categoria']
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          tipo: Database['public']['Enums']['tipo_categoria']
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          tipo?: Database['public']['Enums']['tipo_categoria']
        }
        Relationships: [
          {
            foreignKeyName: 'categorias_financeiras_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categorias_financeiras_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      clientes: {
        Row: {
          anonimizado_em: string | null
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          busca_texto: string
          cpf_cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: string | null
          telefone: string | null
          tipo_pessoa: Database['public']['Enums']['tipo_pessoa']
          vendedor_responsavel_id: string | null
          whatsapp: string | null
        }
        Insert: {
          anonimizado_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          busca_texto?: string
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          tipo_pessoa: Database['public']['Enums']['tipo_pessoa']
          vendedor_responsavel_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          anonimizado_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          busca_texto?: string
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          tipo_pessoa?: Database['public']['Enums']['tipo_pessoa']
          vendedor_responsavel_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clientes_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clientes_vendedor_responsavel_id_fkey'
            columns: ['vendedor_responsavel_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      comissoes: {
        Row: {
          atualizado_em: string
          base: number
          cliente_id: string | null
          competencia: string
          criado_em: string
          descricao: string | null
          fechamento_id: string | null
          id: string
          lancamento_origem_id: string
          percentual: number
          status: Database['public']['Enums']['status_comissao']
          valor: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          base: number
          cliente_id?: string | null
          competencia: string
          criado_em?: string
          descricao?: string | null
          fechamento_id?: string | null
          id?: string
          lancamento_origem_id: string
          percentual: number
          status?: Database['public']['Enums']['status_comissao']
          valor: number
          vendedor_id: string
        }
        Update: {
          atualizado_em?: string
          base?: number
          cliente_id?: string | null
          competencia?: string
          criado_em?: string
          descricao?: string | null
          fechamento_id?: string | null
          id?: string
          lancamento_origem_id?: string
          percentual?: number
          status?: Database['public']['Enums']['status_comissao']
          valor?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comissoes_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_fechamento_id_fkey'
            columns: ['fechamento_id']
            isOneToOne: false
            referencedRelation: 'fechamentos_comissao'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_lancamento_origem_id_fkey'
            columns: ['lancamento_origem_id']
            isOneToOne: true
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_lancamento_origem_id_fkey'
            columns: ['lancamento_origem_id']
            isOneToOne: true
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_lancamento_origem_id_fkey'
            columns: ['lancamento_origem_id']
            isOneToOne: true
            referencedRelation: 'v_movimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          descricao: string | null
          valor: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          descricao?: string | null
          valor: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          descricao?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: 'configuracoes_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      contas_bancarias: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          banco: string | null
          criado_em: string
          criado_por: string | null
          data_saldo_inicial: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: Database['public']['Enums']['tipo_conta']
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          banco?: string | null
          criado_em?: string
          criado_por?: string | null
          data_saldo_inicial?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: Database['public']['Enums']['tipo_conta']
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          banco?: string | null
          criado_em?: string
          criado_por?: string | null
          data_saldo_inicial?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: Database['public']['Enums']['tipo_conta']
        }
        Relationships: [
          {
            foreignKeyName: 'contas_bancarias_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contas_bancarias_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      contatos_cliente: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cargo: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          email: string | null
          endereco_id: string | null
          id: string
          nome: string
          observacoes: string | null
          principal: boolean
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cargo?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          endereco_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          principal?: boolean
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cargo?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          endereco_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          principal?: boolean
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contatos_cliente_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contatos_cliente_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contatos_cliente_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contatos_cliente_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
        ]
      }
      contratos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string
          cliente_id: string
          conta_bancaria_id: string | null
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_util_cobranca: number | null
          endereco_id: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          id: string
          observacoes: string | null
          proposta_id: string | null
          status: Database['public']['Enums']['status_contrato']
          valor_mensal: number
          vendedor_id: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id: string
          cliente_id: string
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao: string
          dia_util_cobranca?: number | null
          endereco_id?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          id?: string
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_contrato']
          valor_mensal: number
          vendedor_id?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string
          cliente_id?: string
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_util_cobranca?: number | null
          endereco_id?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          id?: string
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_contrato']
          valor_mensal?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contratos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias_financeiras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'v_propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contratos_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      enderecos: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          bairro: string | null
          cep: string | null
          cidade: string
          cliente_id: string
          cnpj: string | null
          complemento: string | null
          criado_em: string
          criado_por: string | null
          id: string
          inscricao_estadual: string | null
          logradouro: string
          numero: string | null
          principal: boolean
          razao_social: string | null
          uf: string
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string | null
          cep?: string | null
          cidade: string
          cliente_id: string
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro: string
          numero?: string | null
          principal?: boolean
          razao_social?: string | null
          uf: string
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string
          cliente_id?: string
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string
          numero?: string | null
          principal?: boolean
          razao_social?: string | null
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enderecos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enderecos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enderecos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      fechamentos_comissao: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          competencia: string
          criado_em: string
          criado_por: string | null
          id: string
          lancamento_pagamento_id: string | null
          status: Database['public']['Enums']['status_fechamento']
          valor_total: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          competencia: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          lancamento_pagamento_id?: string | null
          status?: Database['public']['Enums']['status_fechamento']
          valor_total?: number
          vendedor_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          competencia?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          lancamento_pagamento_id?: string | null
          status?: Database['public']['Enums']['status_fechamento']
          valor_total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fechamentos_comissao_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fechamentos_comissao_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fechamentos_comissao_lancamento_pagamento_id_fkey'
            columns: ['lancamento_pagamento_id']
            isOneToOne: false
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fechamentos_comissao_lancamento_pagamento_id_fkey'
            columns: ['lancamento_pagamento_id']
            isOneToOne: false
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fechamentos_comissao_lancamento_pagamento_id_fkey'
            columns: ['lancamento_pagamento_id']
            isOneToOne: false
            referencedRelation: 'v_movimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fechamentos_comissao_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      feriados: {
        Row: {
          abrangencia: Database['public']['Enums']['abrangencia_feriado']
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          id: string
        }
        Insert: {
          abrangencia?: Database['public']['Enums']['abrangencia_feriado']
          criado_em?: string
          criado_por?: string | null
          data: string
          descricao: string
          id?: string
        }
        Update: {
          abrangencia?: Database['public']['Enums']['abrangencia_feriado']
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feriados_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cpf_cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fornecedores_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fornecedores_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      lancamentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string
          cliente_id: string | null
          competencia: string
          confirmado_em: string | null
          confirmado_por: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          data_pagamento: string | null
          descricao: string
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id: string | null
          grupo_parcelamento_id: string | null
          id: string
          numero_nota_fiscal: string | null
          observacoes: string | null
          parcela_numero: number | null
          parcela_total: number | null
          servico_id: string | null
          status: Database['public']['Enums']['status_lancamento']
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id: string
          cliente_id?: string | null
          competencia: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao: string
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          grupo_parcelamento_id?: string | null
          id?: string
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_lancamento']
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string
          cliente_id?: string | null
          competencia?: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          grupo_parcelamento_id?: string | null
          id?: string
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_lancamento']
          tipo?: Database['public']['Enums']['tipo_lancamento']
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias_financeiras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_confirmado_por_fkey'
            columns: ['confirmado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_contrato_id_fkey'
            columns: ['contrato_id']
            isOneToOne: false
            referencedRelation: 'contratos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
        ]
      }
      ordens_servico: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          concluida_em: string | null
          concluida_por: string | null
          criado_em: string
          criado_por: string | null
          data_agendada: string
          descricao: string | null
          endereco_id: string | null
          escopo: Json
          ficha_cliente: Json
          hora_agendada: string | null
          id: string
          modelo_id: string | null
          motivo_reabertura: string | null
          numero: string
          observacoes_adm: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          servico_id: string | null
          status: Database['public']['Enums']['status_os']
          tipo_servico_id: string
          veiculo_id: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data_agendada: string
          descricao?: string | null
          endereco_id?: string | null
          escopo?: Json
          ficha_cliente?: Json
          hora_agendada?: string | null
          id?: string
          modelo_id?: string | null
          motivo_reabertura?: string | null
          numero: string
          observacoes_adm?: string | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_os']
          tipo_servico_id: string
          veiculo_id?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data_agendada?: string
          descricao?: string | null
          endereco_id?: string | null
          escopo?: Json
          ficha_cliente?: Json
          hora_agendada?: string | null
          id?: string
          modelo_id?: string | null
          motivo_reabertura?: string | null
          numero?: string
          observacoes_adm?: string | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_os']
          tipo_servico_id?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ordens_servico_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_concluida_por_fkey'
            columns: ['concluida_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_modelo_id_fkey'
            columns: ['modelo_id']
            isOneToOne: false
            referencedRelation: 'os_modelos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_reaberta_por_fkey'
            columns: ['reaberta_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordens_servico_veiculo_id_fkey'
            columns: ['veiculo_id']
            isOneToOne: false
            referencedRelation: 'veiculos'
            referencedColumns: ['id']
          },
        ]
      }
      os_conferencia: {
        Row: {
          alteracoes: string | null
          atualizado_em: string
          atualizado_por: string | null
          certificado: boolean | null
          criado_em: string
          criado_por: string | null
          cronograma: boolean | null
          destinacao: string | null
          envio_arquivo: boolean
          envio_email: boolean
          envio_relatorios: boolean
          envio_scanner: boolean
          faturado_em: string | null
          lancamento_id: string | null
          logistica: string | null
          numero_nf: string | null
          observacoes: string | null
          os_id: string
          solicitacao: boolean | null
          taxa_faturada: boolean | null
          valor: number | null
          valor_faturado: number | null
          vencimento: string | null
        }
        Insert: {
          alteracoes?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          certificado?: boolean | null
          criado_em?: string
          criado_por?: string | null
          cronograma?: boolean | null
          destinacao?: string | null
          envio_arquivo?: boolean
          envio_email?: boolean
          envio_relatorios?: boolean
          envio_scanner?: boolean
          faturado_em?: string | null
          lancamento_id?: string | null
          logistica?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          os_id: string
          solicitacao?: boolean | null
          taxa_faturada?: boolean | null
          valor?: number | null
          valor_faturado?: number | null
          vencimento?: string | null
        }
        Update: {
          alteracoes?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          certificado?: boolean | null
          criado_em?: string
          criado_por?: string | null
          cronograma?: boolean | null
          destinacao?: string | null
          envio_arquivo?: boolean
          envio_email?: boolean
          envio_relatorios?: boolean
          envio_scanner?: boolean
          faturado_em?: string | null
          lancamento_id?: string | null
          logistica?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          os_id?: string
          solicitacao?: boolean | null
          taxa_faturada?: boolean | null
          valor?: number | null
          valor_faturado?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'os_conferencia_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_conferencia_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_conferencia_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_conferencia_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_conferencia_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_movimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_conferencia_os_id_fkey'
            columns: ['os_id']
            isOneToOne: true
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
        ]
      }
      os_execucao: {
        Row: {
          assinatura_cliente_id: string | null
          assinatura_operador_id: string | null
          atualizado_em: string
          atualizado_por: string | null
          checklist: Json
          criado_em: string
          criado_por: string | null
          data: string | null
          hora_chegada: string | null
          hora_inicio: string | null
          hora_saida: string | null
          hora_termino: string | null
          km_chegada: number | null
          observacoes: string | null
          operador_nome: string | null
          os_id: string
          responsavel_nome: string | null
          responsavel_setor: string | null
          resultado: string | null
          veiculo_id: string | null
        }
        Insert: {
          assinatura_cliente_id?: string | null
          assinatura_operador_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          checklist?: Json
          criado_em?: string
          criado_por?: string | null
          data?: string | null
          hora_chegada?: string | null
          hora_inicio?: string | null
          hora_saida?: string | null
          hora_termino?: string | null
          km_chegada?: number | null
          observacoes?: string | null
          operador_nome?: string | null
          os_id: string
          responsavel_nome?: string | null
          responsavel_setor?: string | null
          resultado?: string | null
          veiculo_id?: string | null
        }
        Update: {
          assinatura_cliente_id?: string | null
          assinatura_operador_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          checklist?: Json
          criado_em?: string
          criado_por?: string | null
          data?: string | null
          hora_chegada?: string | null
          hora_inicio?: string | null
          hora_saida?: string | null
          hora_termino?: string | null
          km_chegada?: number | null
          observacoes?: string | null
          operador_nome?: string | null
          os_id?: string
          responsavel_nome?: string | null
          responsavel_setor?: string | null
          resultado?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'assinatura_cliente_fk'
            columns: ['assinatura_cliente_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assinatura_operador_fk'
            columns: ['assinatura_operador_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_execucao_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_execucao_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_execucao_os_id_fkey'
            columns: ['os_id']
            isOneToOne: true
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_execucao_veiculo_id_fkey'
            columns: ['veiculo_id']
            isOneToOne: false
            referencedRelation: 'veiculos'
            referencedColumns: ['id']
          },
        ]
      }
      os_insetos: {
        Row: {
          area: string
          atualizado_em: string
          atualizado_por: string | null
          calda: string | null
          condicoes: string | null
          criado_em: string
          criado_por: string | null
          diluente: string | null
          id: string
          nivel: string | null
          os_id: string
          praga: string
          principio_ativo: string | null
          procedimento: string | null
          pronto_uso: boolean | null
          quantidade: string | null
        }
        Insert: {
          area: string
          atualizado_em?: string
          atualizado_por?: string | null
          calda?: string | null
          condicoes?: string | null
          criado_em?: string
          criado_por?: string | null
          diluente?: string | null
          id?: string
          nivel?: string | null
          os_id: string
          praga: string
          principio_ativo?: string | null
          procedimento?: string | null
          pronto_uso?: boolean | null
          quantidade?: string | null
        }
        Update: {
          area?: string
          atualizado_em?: string
          atualizado_por?: string | null
          calda?: string | null
          condicoes?: string | null
          criado_em?: string
          criado_por?: string | null
          diluente?: string | null
          id?: string
          nivel?: string | null
          os_id?: string
          praga?: string
          principio_ativo?: string | null
          procedimento?: string | null
          pronto_uso?: boolean | null
          quantidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'os_insetos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_insetos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_insetos_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
        ]
      }
      os_modelos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          endereco_id: string | null
          escopo: Json
          id: string
          observacoes_adm_padrao: string | null
          operadores_padrao: string[]
          tipo_servico_id: string
          veiculo_padrao_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          endereco_id?: string | null
          escopo?: Json
          id?: string
          observacoes_adm_padrao?: string | null
          operadores_padrao?: string[]
          tipo_servico_id: string
          veiculo_padrao_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          endereco_id?: string | null
          escopo?: Json
          id?: string
          observacoes_adm_padrao?: string | null
          operadores_padrao?: string[]
          tipo_servico_id?: string
          veiculo_padrao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'os_modelos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_modelos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_modelos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_modelos_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_modelos_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_modelos_veiculo_padrao_id_fkey'
            columns: ['veiculo_padrao_id']
            isOneToOne: false
            referencedRelation: 'veiculos'
            referencedColumns: ['id']
          },
        ]
      }
      os_operadores: {
        Row: {
          operador_id: string
          os_id: string
        }
        Insert: {
          operador_id: string
          os_id: string
        }
        Update: {
          operador_id?: string
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'os_operadores_operador_id_fkey'
            columns: ['operador_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_operadores_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
        ]
      }
      os_pontos: {
        Row: {
          area: string
          atualizado_em: string
          atualizado_por: string | null
          capturas: Json
          criado_em: string
          criado_por: string | null
          forma_iscagem: string | null
          foto_antes: boolean | null
          higiene: string | null
          id: string
          lampadas_trocadas: boolean | null
          material: string | null
          modelo_armadilha: string | null
          numero: number
          observacao: string | null
          os_id: string
          ponto_id: string | null
          quantidade: number | null
          quantidade_telas: number | null
          refil: string | null
          situacao: string | null
          situacao_armadilha: string | null
          sujidade: string | null
          tipo: Database['public']['Enums']['tipo_ponto']
          tipo_isca: string | null
          ultima_troca_lampada: string | null
        }
        Insert: {
          area: string
          atualizado_em?: string
          atualizado_por?: string | null
          capturas?: Json
          criado_em?: string
          criado_por?: string | null
          forma_iscagem?: string | null
          foto_antes?: boolean | null
          higiene?: string | null
          id?: string
          lampadas_trocadas?: boolean | null
          material?: string | null
          modelo_armadilha?: string | null
          numero: number
          observacao?: string | null
          os_id: string
          ponto_id?: string | null
          quantidade?: number | null
          quantidade_telas?: number | null
          refil?: string | null
          situacao?: string | null
          situacao_armadilha?: string | null
          sujidade?: string | null
          tipo: Database['public']['Enums']['tipo_ponto']
          tipo_isca?: string | null
          ultima_troca_lampada?: string | null
        }
        Update: {
          area?: string
          atualizado_em?: string
          atualizado_por?: string | null
          capturas?: Json
          criado_em?: string
          criado_por?: string | null
          forma_iscagem?: string | null
          foto_antes?: boolean | null
          higiene?: string | null
          id?: string
          lampadas_trocadas?: boolean | null
          material?: string | null
          modelo_armadilha?: string | null
          numero?: number
          observacao?: string | null
          os_id?: string
          ponto_id?: string | null
          quantidade?: number | null
          quantidade_telas?: number | null
          refil?: string | null
          situacao?: string | null
          situacao_armadilha?: string | null
          sujidade?: string | null
          tipo?: Database['public']['Enums']['tipo_ponto']
          tipo_isca?: string | null
          ultima_troca_lampada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'os_pontos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_pontos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_pontos_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_pontos_ponto_id_fkey'
            columns: ['ponto_id']
            isOneToOne: false
            referencedRelation: 'pontos_controle'
            referencedColumns: ['id']
          },
        ]
      }
      os_produtos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          forma: string
          gramas: number | null
          id: string
          os_id: string
          principio_ativo: string
          unidades: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          forma: string
          gramas?: number | null
          id?: string
          os_id: string
          principio_ativo: string
          unidades?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          forma?: string
          gramas?: number | null
          id?: string
          os_id?: string
          principio_ativo?: string
          unidades?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'os_produtos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_produtos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'os_produtos_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          comissao_percentual: number | null
          criado_em: string
          email: string
          id: string
          nome: string
          papel: Database['public']['Enums']['papel']
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          comissao_percentual?: number | null
          criado_em?: string
          email: string
          id: string
          nome: string
          papel?: Database['public']['Enums']['papel']
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          comissao_percentual?: number | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          papel?: Database['public']['Enums']['papel']
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'perfis_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      pontos_controle: {
        Row: {
          area: string
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          forma_iscagem: string | null
          id: string
          material: string | null
          modelo_armadilha: string | null
          modelo_id: string
          numero: number
          quantidade: number | null
          quantidade_telas: number | null
          tipo: Database['public']['Enums']['tipo_ponto']
          tipo_isca: string | null
        }
        Insert: {
          area: string
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          forma_iscagem?: string | null
          id?: string
          material?: string | null
          modelo_armadilha?: string | null
          modelo_id: string
          numero: number
          quantidade?: number | null
          quantidade_telas?: number | null
          tipo: Database['public']['Enums']['tipo_ponto']
          tipo_isca?: string | null
        }
        Update: {
          area?: string
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          forma_iscagem?: string | null
          id?: string
          material?: string | null
          modelo_armadilha?: string | null
          modelo_id?: string
          numero?: number
          quantidade?: number | null
          quantidade_telas?: number | null
          tipo?: Database['public']['Enums']['tipo_ponto']
          tipo_isca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pontos_controle_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pontos_controle_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pontos_controle_modelo_id_fkey'
            columns: ['modelo_id']
            isOneToOne: false
            referencedRelation: 'os_modelos'
            referencedColumns: ['id']
          },
        ]
      }
      proposta_itens: {
        Row: {
          descricao: string
          id: string
          ordem: number
          periodicidade_meses: number | null
          proposta_id: string
          quantidade: number
          tipo_servico_id: string | null
          valor_unitario: number
        }
        Insert: {
          descricao: string
          id?: string
          ordem?: number
          periodicidade_meses?: number | null
          proposta_id: string
          quantidade?: number
          tipo_servico_id?: string | null
          valor_unitario: number
        }
        Update: {
          descricao?: string
          id?: string
          ordem?: number
          periodicidade_meses?: number | null
          proposta_id?: string
          quantidade?: number
          tipo_servico_id?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: 'proposta_itens_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proposta_itens_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'v_propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proposta_itens_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
        ]
      }
      propostas: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          condicao_pagamento: string | null
          criado_em: string
          criado_por: string | null
          data_envio: string
          data_resposta: string | null
          endereco_id: string | null
          id: string
          motivo_recusa: string | null
          numero: string
          observacoes: string | null
          prazo_pagamento_dias: number | null
          status: Database['public']['Enums']['status_proposta']
          validade: string | null
          valor_total: number
          vendedor_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          condicao_pagamento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_envio?: string
          data_resposta?: string | null
          endereco_id?: string | null
          id?: string
          motivo_recusa?: string | null
          numero?: string
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          status?: Database['public']['Enums']['status_proposta']
          validade?: string | null
          valor_total?: number
          vendedor_id?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          condicao_pagamento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_envio?: string
          data_resposta?: string | null
          endereco_id?: string | null
          id?: string
          motivo_recusa?: string | null
          numero?: string
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          status?: Database['public']['Enums']['status_proposta']
          validade?: string | null
          valor_total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'propostas_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      servicos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          data_execucao: string
          endereco_id: string | null
          id: string
          numero_certificado: string | null
          observacoes: string | null
          periodicidade_meses: number | null
          proposta_id: string | null
          status: Database['public']['Enums']['status_servico']
          tecnicos: string | null
          tipo_servico_id: string
          valor: number | null
          vendedor_id: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          data_execucao: string
          endereco_id?: string | null
          id?: string
          numero_certificado?: string | null
          observacoes?: string | null
          periodicidade_meses?: number | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_servico']
          tecnicos?: string | null
          tipo_servico_id: string
          valor?: number | null
          vendedor_id?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          data_execucao?: string
          endereco_id?: string | null
          id?: string
          numero_certificado?: string | null
          observacoes?: string | null
          periodicidade_meses?: number | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_servico']
          tecnicos?: string | null
          tipo_servico_id?: string
          valor?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'servicos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_proposta_id_fkey'
            columns: ['proposta_id']
            isOneToOne: false
            referencedRelation: 'v_propostas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicos_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      tipos_servico: {
        Row: {
          antecedencia_aviso_dias_padrao: number
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          formulario_os: Database['public']['Enums']['formulario_os']
          id: string
          nome: string
          periodicidade_meses_padrao: number | null
          tipo_vencimento: Database['public']['Enums']['tipo_vencimento'] | null
        }
        Insert: {
          antecedencia_aviso_dias_padrao?: number
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          formulario_os?: Database['public']['Enums']['formulario_os']
          id?: string
          nome: string
          periodicidade_meses_padrao?: number | null
          tipo_vencimento?: Database['public']['Enums']['tipo_vencimento'] | null
        }
        Update: {
          antecedencia_aviso_dias_padrao?: number
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          formulario_os?: Database['public']['Enums']['formulario_os']
          id?: string
          nome?: string
          periodicidade_meses_padrao?: number | null
          tipo_vencimento?: Database['public']['Enums']['tipo_vencimento'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'tipos_servico_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tipos_servico_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      transferencias_cliente: {
        Row: {
          cliente_id: string
          em: string
          feito_por: string | null
          id: string
          motivo: string | null
          vendedor_anterior_id: string | null
          vendedor_novo_id: string | null
        }
        Insert: {
          cliente_id: string
          em?: string
          feito_por?: string | null
          id?: string
          motivo?: string | null
          vendedor_anterior_id?: string | null
          vendedor_novo_id?: string | null
        }
        Update: {
          cliente_id?: string
          em?: string
          feito_por?: string | null
          id?: string
          motivo?: string | null
          vendedor_anterior_id?: string | null
          vendedor_novo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transferencias_cliente_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transferencias_cliente_feito_por_fkey'
            columns: ['feito_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transferencias_cliente_vendedor_anterior_id_fkey'
            columns: ['vendedor_anterior_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transferencias_cliente_vendedor_novo_id_fkey'
            columns: ['vendedor_novo_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      veiculos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          placa: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          placa: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          placa?: string
        }
        Relationships: [
          {
            foreignKeyName: 'veiculos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'veiculos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      vencimentos_servico: {
        Row: {
          antecedencia_aviso_dias: number
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          data_ultimo_servico: string | null
          endereco_id: string | null
          id: string
          periodicidade_meses: number
          proxima_data: string | null
          tipo_servico_id: string
          ultimo_servico_id: string | null
        }
        Insert: {
          antecedencia_aviso_dias?: number
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          data_ultimo_servico?: string | null
          endereco_id?: string | null
          id?: string
          periodicidade_meses: number
          proxima_data?: string | null
          tipo_servico_id: string
          ultimo_servico_id?: string | null
        }
        Update: {
          antecedencia_aviso_dias?: number
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          data_ultimo_servico?: string | null
          endereco_id?: string | null
          id?: string
          periodicidade_meses?: number
          proxima_data?: string | null
          tipo_servico_id?: string
          ultimo_servico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vencimentos_servico_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_ultimo_servico_id_fkey'
            columns: ['ultimo_servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v_lancamentos: {
        Row: {
          atrasado: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          categoria_id: string | null
          cliente_id: string | null
          competencia: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_pagamento: string | null
          descricao: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id: string | null
          grupo_parcelamento_id: string | null
          id: string | null
          numero_nota_fiscal: string | null
          observacoes: string | null
          parcela_numero: number | null
          parcela_total: number | null
          servico_id: string | null
          situacao: string | null
          status: Database['public']['Enums']['status_lancamento'] | null
          tipo: Database['public']['Enums']['tipo_lancamento'] | null
          valor: number | null
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          atrasado?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          competencia?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          grupo_parcelamento_id?: string | null
          id?: string | null
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          servico_id?: string | null
          situacao?: never
          status?: Database['public']['Enums']['status_lancamento'] | null
          tipo?: Database['public']['Enums']['tipo_lancamento'] | null
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          atrasado?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          competencia?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          grupo_parcelamento_id?: string | null
          id?: string | null
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          servico_id?: string | null
          situacao?: never
          status?: Database['public']['Enums']['status_lancamento'] | null
          tipo?: Database['public']['Enums']['tipo_lancamento'] | null
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias_financeiras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_confirmado_por_fkey'
            columns: ['confirmado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_contrato_id_fkey'
            columns: ['contrato_id']
            isOneToOne: false
            referencedRelation: 'contratos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
        ]
      }
      v_movimentos: {
        Row: {
          conta_bancaria_id: string | null
          data_pagamento: string | null
          id: string | null
          valor_com_sinal: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
        ]
      }
      v_propostas: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          cliente_id: string | null
          condicao_pagamento: string | null
          criado_em: string | null
          criado_por: string | null
          data_envio: string | null
          data_resposta: string | null
          dias_sem_resposta: number | null
          endereco_id: string | null
          id: string | null
          motivo_recusa: string | null
          numero: string | null
          observacoes: string | null
          prazo_pagamento_dias: number | null
          situacao: string | null
          status: Database['public']['Enums']['status_proposta'] | null
          validade: string | null
          valor_total: number | null
          vendedor_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          condicao_pagamento?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          dias_sem_resposta?: never
          endereco_id?: string | null
          id?: string | null
          motivo_recusa?: string | null
          numero?: string | null
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          situacao?: never
          status?: Database['public']['Enums']['status_proposta'] | null
          validade?: string | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          condicao_pagamento?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          dias_sem_resposta?: never
          endereco_id?: string | null
          id?: string | null
          motivo_recusa?: string | null
          numero?: string | null
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          situacao?: never
          status?: Database['public']['Enums']['status_proposta'] | null
          validade?: string | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'propostas_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'propostas_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      v_saldos_contas: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          banco: string | null
          criado_em: string | null
          criado_por: string | null
          data_saldo_inicial: string | null
          id: string | null
          nome: string | null
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: Database['public']['Enums']['tipo_conta'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'contas_bancarias_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contas_bancarias_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      v_vencimentos: {
        Row: {
          antecedencia_aviso_dias: number | null
          ativo: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          cliente_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_ultimo_servico: string | null
          dias_para_vencer: number | null
          endereco_id: string | null
          id: string | null
          periodicidade_meses: number | null
          proxima_data: string | null
          situacao: string | null
          tipo_servico_id: string | null
          ultimo_servico_id: string | null
        }
        Insert: {
          antecedencia_aviso_dias?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_ultimo_servico?: string | null
          dias_para_vencer?: never
          endereco_id?: string | null
          id?: string | null
          periodicidade_meses?: number | null
          proxima_data?: string | null
          situacao?: never
          tipo_servico_id?: string | null
          ultimo_servico_id?: string | null
        }
        Update: {
          antecedencia_aviso_dias?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_ultimo_servico?: string | null
          dias_para_vencer?: never
          endereco_id?: string | null
          id?: string | null
          periodicidade_meses?: number | null
          proxima_data?: string | null
          situacao?: never
          tipo_servico_id?: string | null
          ultimo_servico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vencimentos_servico_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vencimentos_servico_ultimo_servico_id_fkey'
            columns: ['ultimo_servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      anonimizar_cliente: { Args: { cliente: string }; Returns: undefined }
      atualizar_avisos: { Args: never; Returns: number }
      atualizar_pontos_os: { Args: { os: string }; Returns: undefined }
      buscar_clientes: {
        Args: { incluir_inativos?: boolean; termo?: string }
        Returns: {
          anonimizado_em: string | null
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          busca_texto: string
          cpf_cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: string | null
          telefone: string | null
          tipo_pessoa: Database['public']['Enums']['tipo_pessoa']
          vendedor_responsavel_id: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'clientes'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      concluir_os: { Args: { os: string }; Returns: undefined }
      conferir_os: { Args: { os: string }; Returns: undefined }
      dia_util: {
        Args: { ano: number; mes: number; n?: number }
        Returns: string
      }
      faturar_os: {
        Args: {
          numero_nf?: string
          os: string
          valor: number
          vencimento: string
        }
        Returns: string
      }
      fechar_comissoes: {
        Args: {
          conta?: string
          mes: string
          vencimento: string
          vendedor: string
        }
        Returns: string
      }
      feriados_nacionais: {
        Args: { ano: number }
        Returns: {
          data: string
          descricao: string
        }[]
      }
      gerar_cobrancas_contratos: { Args: never; Returns: number }
      gerar_os_do_modelo: {
        Args: {
          data: string
          hora?: string
          modelo: string
          observacoes_adm?: string
          operadores?: string[]
          veiculo?: string
        }
        Returns: string
      }
      iniciar_os: { Args: { os: string }; Returns: undefined }
      painel_financeiro: { Args: never; Returns: Json }
      pendencias_os: { Args: { os: string }; Returns: string[] }
      reabrir_os: { Args: { motivo: string; os: string }; Returns: undefined }
      resumo_mensal: {
        Args: { meses_antes?: number; meses_depois?: number }
        Returns: {
          despesas: number
          faturamento: number
          fluxo: number
          mes: string
          pago: number
          recebido: number
          resultado: number
          saldo_acumulado: number
        }[]
      }
      salvar_itens_proposta: {
        Args: { itens: Json; proposta: string }
        Returns: undefined
      }
      servicos_do_cliente_sem_valor: {
        Args: { cliente: string }
        Returns: {
          data_execucao: string
          endereco: string
          id: string
          numero_certificado: string
          status: Database['public']['Enums']['status_servico']
          tipo_servico: string
          vendedor: string
        }[]
      }
      transferir_carteira: {
        Args: { motivo?: string; novo_vendedor: string; vendedor_atual: string }
        Returns: number
      }
      transferir_cliente: {
        Args: { cliente: string; motivo?: string; novo_vendedor: string }
        Returns: undefined
      }
    }
    Enums: {
      abrangencia_feriado: 'estadual' | 'municipal' | 'outro'
      canal_atendimento: 'telefone' | 'whatsapp' | 'presencial' | 'email' | 'outro'
      categoria_arquivo:
        | 'proposta'
        | 'certificado'
        | 'relatorio'
        | 'foto_antes'
        | 'foto_depois'
        | 'comprovante'
        | 'nota_fiscal'
        | 'contrato'
        | 'outro'
        | 'foto_os'
        | 'assinatura'
      forma_pagamento:
        'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'debito_automatico' | 'outro'
      formulario_os: 'generico' | 'pragas' | 'coifa'
      papel: 'admin' | 'financeiro' | 'vendedor' | 'recepcao' | 'operador'
      status_comissao: 'prevista' | 'paga' | 'cancelada'
      status_contrato: 'ativo' | 'suspenso' | 'encerrado'
      status_fechamento: 'aberto' | 'pago'
      status_lancamento: 'pendente' | 'agendado' | 'realizado' | 'cancelado'
      status_os: 'rascunho' | 'agendada' | 'em_execucao' | 'concluida' | 'conferida' | 'cancelada'
      status_proposta: 'enviada' | 'aprovada' | 'recusada'
      status_servico: 'agendado' | 'realizado' | 'cancelado'
      tipo_categoria: 'receita' | 'despesa'
      tipo_conta: 'corrente' | 'poupanca' | 'caixa' | 'outro'
      tipo_lancamento: 'entrada' | 'saida'
      tipo_pessoa: 'PF' | 'PJ'
      tipo_ponto: 'porta_isca' | 'armadilha_luminosa' | 'coifa'
      tipo_vencimento: 'certificado' | 'recomendacao'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      abrangencia_feriado: ['estadual', 'municipal', 'outro'],
      canal_atendimento: ['telefone', 'whatsapp', 'presencial', 'email', 'outro'],
      categoria_arquivo: [
        'proposta',
        'certificado',
        'relatorio',
        'foto_antes',
        'foto_depois',
        'comprovante',
        'nota_fiscal',
        'contrato',
        'outro',
        'foto_os',
        'assinatura',
      ],
      forma_pagamento: [
        'pix',
        'boleto',
        'transferencia',
        'cartao',
        'dinheiro',
        'debito_automatico',
        'outro',
      ],
      formulario_os: ['generico', 'pragas', 'coifa'],
      papel: ['admin', 'financeiro', 'vendedor', 'recepcao', 'operador'],
      status_comissao: ['prevista', 'paga', 'cancelada'],
      status_contrato: ['ativo', 'suspenso', 'encerrado'],
      status_fechamento: ['aberto', 'pago'],
      status_lancamento: ['pendente', 'agendado', 'realizado', 'cancelado'],
      status_os: ['rascunho', 'agendada', 'em_execucao', 'concluida', 'conferida', 'cancelada'],
      status_proposta: ['enviada', 'aprovada', 'recusada'],
      status_servico: ['agendado', 'realizado', 'cancelado'],
      tipo_categoria: ['receita', 'despesa'],
      tipo_conta: ['corrente', 'poupanca', 'caixa', 'outro'],
      tipo_lancamento: ['entrada', 'saida'],
      tipo_pessoa: ['PF', 'PJ'],
      tipo_ponto: ['porta_isca', 'armadilha_luminosa', 'coifa'],
      tipo_vencimento: ['certificado', 'recomendacao'],
    },
  },
} as const

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      agenda_dias: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          data: string
          escalas: Json
          mensagem: string
          observacoes: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data: string
          escalas?: Json
          mensagem?: string
          observacoes?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          escalas?: Json
          mensagem?: string
          observacoes?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agenda_dias_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agenda_dias_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      agenda_itens: {
        Row: {
          almoco: string
          atualizado_em: string
          atualizado_por: string | null
          avulso: boolean
          chegada: string
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          faturado: boolean
          hora: string
          horario_cliente: boolean
          id: string
          nota: string
          ordem: number
          periodo: string
          realizado: boolean
          tecnicos: number[]
          veiculo: string
        }
        Insert: {
          almoco?: string
          atualizado_em?: string
          atualizado_por?: string | null
          avulso?: boolean
          chegada?: string
          criado_em?: string
          criado_por?: string | null
          data: string
          descricao?: string
          faturado?: boolean
          hora?: string
          horario_cliente?: boolean
          id?: string
          nota?: string
          ordem?: number
          periodo?: string
          realizado?: boolean
          tecnicos?: number[]
          veiculo?: string
        }
        Update: {
          almoco?: string
          atualizado_em?: string
          atualizado_por?: string | null
          avulso?: boolean
          chegada?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          faturado?: boolean
          hora?: string
          horario_cliente?: boolean
          id?: string
          nota?: string
          ordem?: number
          periodo?: string
          realizado?: boolean
          tecnicos?: number[]
          veiculo?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agenda_itens_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agenda_itens_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agenda_itens_data_fkey'
            columns: ['data']
            isOneToOne: false
            referencedRelation: 'agenda_dias'
            referencedColumns: ['data']
          },
        ]
      }
      agenda_tecnicos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cnh: string
          criado_em: string
          criado_por: string | null
          nome: string
          numero: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cnh?: string
          criado_em?: string
          criado_por?: string | null
          nome: string
          numero: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cnh?: string
          criado_em?: string
          criado_por?: string | null
          nome?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: 'agenda_tecnicos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agenda_tecnicos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      agenda_veiculos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          codigo: string
          criado_em: string
          criado_por: string | null
          placa: string
          tem_sem_parar: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          codigo: string
          criado_em?: string
          criado_por?: string | null
          placa?: string
          tem_sem_parar?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          placa?: string
          tem_sem_parar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'agenda_veiculos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agenda_veiculos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      antecipacoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          conta_bancaria_id: string
          criado_em: string
          criado_por: string | null
          data: string
          desconto: number
          desfeita: boolean
          id: string
          instituicao: string
          observacoes: string | null
          valor_bruto: number
          valor_liquido: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          conta_bancaria_id: string
          criado_em?: string
          criado_por?: string | null
          data: string
          desconto: number
          desfeita?: boolean
          id?: string
          instituicao: string
          observacoes?: string | null
          valor_bruto: number
          valor_liquido?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          conta_bancaria_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          desconto?: number
          desfeita?: boolean
          id?: string
          instituicao?: string
          observacoes?: string | null
          valor_bruto?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'antecipacoes_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'antecipacoes_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'antecipacoes_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'antecipacoes_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
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
          certificado_id: string | null
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
          certificado_id?: string | null
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
          certificado_id?: string | null
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
            foreignKeyName: 'avisos_certificado_id_fkey'
            columns: ['certificado_id']
            isOneToOne: false
            referencedRelation: 'certificados'
            referencedColumns: ['id']
          },
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
      cartoes_credito: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          conta_bancaria_id: string | null
          criado_em: string
          criado_por: string | null
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          limite?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite?: number | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cartoes_credito_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_credito_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_credito_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_credito_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
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
      certificados: {
        Row: {
          areas: string | null
          assinatura_digital: boolean
          atualizado_em: string
          atualizado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_id: string
          complemento: string | null
          criado_em: string
          criado_por: string | null
          data_execucao: string
          descricao: string | null
          endereco_id: string | null
          ficha_cliente: Json
          id: string
          modelo: string
          motivo_cancelamento: string | null
          mtr: string | null
          numero: string
          observacao_final: string | null
          os_id: string | null
          outras_datas: string[]
          pragas_alvo: string | null
          produtos: Json
          reservatorios: Json
          responsavel_nome: string | null
          responsavel_registro: string | null
          servico_descrito: string
          servico_id: string | null
          tipo_servico_id: string
          tipo_validade: string
          titulo: string
          validade: string | null
          validade_meses: number | null
          volume: string | null
        }
        Insert: {
          areas?: string | null
          assinatura_digital?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id: string
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_execucao: string
          descricao?: string | null
          endereco_id?: string | null
          ficha_cliente?: Json
          id?: string
          modelo?: string
          motivo_cancelamento?: string | null
          mtr?: string | null
          numero: string
          observacao_final?: string | null
          os_id?: string | null
          outras_datas?: string[]
          pragas_alvo?: string | null
          produtos?: Json
          reservatorios?: Json
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          servico_descrito: string
          servico_id?: string | null
          tipo_servico_id: string
          tipo_validade?: string
          titulo: string
          validade?: string | null
          validade_meses?: number | null
          volume?: string | null
        }
        Update: {
          areas?: string | null
          assinatura_digital?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_execucao?: string
          descricao?: string | null
          endereco_id?: string | null
          ficha_cliente?: Json
          id?: string
          modelo?: string
          motivo_cancelamento?: string | null
          mtr?: string | null
          numero?: string
          observacao_final?: string | null
          os_id?: string | null
          outras_datas?: string[]
          pragas_alvo?: string | null
          produtos?: Json
          reservatorios?: Json
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          servico_descrito?: string
          servico_id?: string | null
          tipo_servico_id?: string
          tipo_validade?: string
          titulo?: string
          validade?: string | null
          validade_meses?: number | null
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'certificados_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_cancelado_por_fkey'
            columns: ['cancelado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_endereco_id_fkey'
            columns: ['endereco_id']
            isOneToOne: false
            referencedRelation: 'enderecos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_os_id_fkey'
            columns: ['os_id']
            isOneToOne: false
            referencedRelation: 'ordens_servico'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_servico_id_fkey'
            columns: ['servico_id']
            isOneToOne: false
            referencedRelation: 'servicos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'certificados_tipo_servico_id_fkey'
            columns: ['tipo_servico_id']
            isOneToOne: false
            referencedRelation: 'tipos_servico'
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
          dia_vencimento: number | null
          endereco_id: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          id: string
          observacoes: string | null
          proposta_id: string | null
          status: Database['public']['Enums']['status_contrato']
          valor_mensal: number
          vence_mes_seguinte: boolean
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
          dia_vencimento?: number | null
          endereco_id?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          id?: string
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_contrato']
          valor_mensal: number
          vence_mes_seguinte?: boolean
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
          dia_vencimento?: number | null
          endereco_id?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          id?: string
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database['public']['Enums']['status_contrato']
          valor_mensal?: number
          vence_mes_seguinte?: boolean
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
      custos_orcamento: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'custos_orcamento_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      descricoes_contrato: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          condicoes: string | null
          conferido_em: string | null
          criado_em: string
          criado_por: string | null
          data_assinatura: string | null
          documentos: string[]
          horario_atendimento: string | null
          id: string
          itens: Json
          numero_contrato: string | null
          pendencias: string | null
          reajuste: string | null
          renovacao: string | null
          servicos_extras: string | null
          taxa_fora_horario: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          condicoes?: string | null
          conferido_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_assinatura?: string | null
          documentos?: string[]
          horario_atendimento?: string | null
          id?: string
          itens?: Json
          numero_contrato?: string | null
          pendencias?: string | null
          reajuste?: string | null
          renovacao?: string | null
          servicos_extras?: string | null
          taxa_fora_horario?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          condicoes?: string | null
          conferido_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_assinatura?: string | null
          documentos?: string[]
          horario_atendimento?: string | null
          id?: string
          itens?: Json
          numero_contrato?: string | null
          pendencias?: string | null
          reajuste?: string | null
          renovacao?: string | null
          servicos_extras?: string | null
          taxa_fora_horario?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'descricoes_contrato_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'descricoes_contrato_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: true
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'descricoes_contrato_criado_por_fkey'
            columns: ['criado_por']
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
          codigo_ibge: string | null
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
          codigo_ibge?: string | null
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
          codigo_ibge?: string | null
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
      investimentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          data_saldo_inicial: string
          id: string
          instituicao: string | null
          nome: string
          saldo_inicial: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data_saldo_inicial?: string
          id?: string
          instituicao?: string | null
          nome: string
          saldo_inicial?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data_saldo_inicial?: string
          id?: string
          instituicao?: string | null
          nome?: string
          saldo_inicial?: number
        }
        Relationships: [
          {
            foreignKeyName: 'investimentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investimentos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      lancamentos: {
        Row: {
          antecipacao_id: string | null
          atualizado_em: string
          atualizado_por: string | null
          cartao_credito_id: string | null
          categoria_id: string
          cliente_id: string | null
          competencia: string
          confirmado_em: string | null
          confirmado_por: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          data_compra: string | null
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
          recorrente_id: string | null
          servico_id: string | null
          status: Database['public']['Enums']['status_lancamento']
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          antecipacao_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cartao_credito_id?: string | null
          categoria_id: string
          cliente_id?: string | null
          competencia: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_compra?: string | null
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
          recorrente_id?: string | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_lancamento']
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          antecipacao_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cartao_credito_id?: string | null
          categoria_id?: string
          cliente_id?: string | null
          competencia?: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_compra?: string | null
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
          recorrente_id?: string | null
          servico_id?: string | null
          status?: Database['public']['Enums']['status_lancamento']
          tipo?: Database['public']['Enums']['tipo_lancamento']
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_antecipacao_id_fkey'
            columns: ['antecipacao_id']
            isOneToOne: false
            referencedRelation: 'antecipacoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_cartao_credito_id_fkey'
            columns: ['cartao_credito_id']
            isOneToOne: false
            referencedRelation: 'cartoes_credito'
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
            foreignKeyName: 'lancamentos_recorrente_id_fkey'
            columns: ['recorrente_id']
            isOneToOne: false
            referencedRelation: 'lancamentos_recorrentes'
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
      lancamentos_recorrentes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string
          cliente_id: string | null
          conta_bancaria_id: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id: string
          cliente_id?: string | null
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          tipo: Database['public']['Enums']['tipo_lancamento']
          valor: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string
          cliente_id?: string | null
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          tipo?: Database['public']['Enums']['tipo_lancamento']
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_recorrentes_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias_financeiras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_recorrentes_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
        ]
      }
      movimentos_investimento: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cancelado: boolean
          conta_bancaria_id: string | null
          criado_em: string
          criado_por: string | null
          data: string
          id: string
          investimento_id: string
          observacoes: string | null
          tipo: Database['public']['Enums']['tipo_movimento_investimento']
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cancelado?: boolean
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data: string
          id?: string
          investimento_id: string
          observacoes?: string | null
          tipo: Database['public']['Enums']['tipo_movimento_investimento']
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cancelado?: boolean
          conta_bancaria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          id?: string
          investimento_id?: string
          observacoes?: string | null
          tipo?: Database['public']['Enums']['tipo_movimento_investimento']
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'movimentos_investimento_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentos_investimento_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'contas_bancarias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentos_investimento_conta_bancaria_id_fkey'
            columns: ['conta_bancaria_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_contas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentos_investimento_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentos_investimento_investimento_id_fkey'
            columns: ['investimento_id']
            isOneToOne: false
            referencedRelation: 'investimentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentos_investimento_investimento_id_fkey'
            columns: ['investimento_id']
            isOneToOne: false
            referencedRelation: 'v_saldos_investimentos'
            referencedColumns: ['id']
          },
        ]
      }
      nfse_adn_leitura: {
        Row: {
          atualizado_em: string
          id: number
          ultimo_nsu: number
        }
        Insert: {
          atualizado_em?: string
          id?: number
          ultimo_nsu?: number
        }
        Update: {
          atualizado_em?: string
          id?: number
          ultimo_nsu?: number
        }
        Relationships: []
      }
      nfse_adn_notas: {
        Row: {
          aliquota_cofins: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          cancelada: boolean
          chave: string
          codigo_municipal: string | null
          codigo_nbs: string | null
          codigo_tributacao: string | null
          criado_em: string
          descricao: string | null
          emitida_em: string | null
          iss_retido: boolean
          municipio_prestacao: string | null
          nsu: number
          numero: string | null
          tomador_doc: string | null
          tomador_nome: string | null
          tp_ret_piscofins: number | null
          valor: number | null
          valor_cofins: number | null
          valor_inss: number | null
          valor_irrf: number | null
          valor_pis: number | null
          valor_ret_csll: number | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          cancelada?: boolean
          chave: string
          codigo_municipal?: string | null
          codigo_nbs?: string | null
          codigo_tributacao?: string | null
          criado_em?: string
          descricao?: string | null
          emitida_em?: string | null
          iss_retido?: boolean
          municipio_prestacao?: string | null
          nsu: number
          numero?: string | null
          tomador_doc?: string | null
          tomador_nome?: string | null
          tp_ret_piscofins?: number | null
          valor?: number | null
          valor_cofins?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_pis?: number | null
          valor_ret_csll?: number | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          cancelada?: boolean
          chave?: string
          codigo_municipal?: string | null
          codigo_nbs?: string | null
          codigo_tributacao?: string | null
          criado_em?: string
          descricao?: string | null
          emitida_em?: string | null
          iss_retido?: boolean
          municipio_prestacao?: string | null
          nsu?: number
          numero?: string | null
          tomador_doc?: string | null
          tomador_nome?: string | null
          tp_ret_piscofins?: number | null
          valor?: number | null
          valor_cofins?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_pis?: number | null
          valor_ret_csll?: number | null
        }
        Relationships: []
      }
      nfse_numeracao: {
        Row: {
          ambiente: string
          serie: string
          ultimo: number
        }
        Insert: {
          ambiente: string
          serie: string
          ultimo?: number
        }
        Update: {
          ambiente?: string
          serie?: string
          ultimo?: number
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          aliquota_cofins: number | null
          aliquota_csll: number | null
          aliquota_inss: number | null
          aliquota_irrf: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          ambiente_nfse: string | null
          arquivo_boleto_id: string | null
          arquivo_cancelamento_id: string | null
          arquivo_pdf_id: string | null
          arquivo_xml_id: string | null
          atualizado_em: string
          atualizado_por: string | null
          boleto_banco: string | null
          boleto_cobranca_id: string | null
          boleto_codigo_barras: string | null
          boleto_consultado_em: string | null
          boleto_gerado_em: string | null
          boleto_linha_digitavel: string | null
          boleto_na_emissao: boolean
          boleto_nosso_numero: string | null
          boleto_pix: string | null
          boleto_situacao: string | null
          boleto_valor: number | null
          boleto_vencimento: string | null
          cancelada_em: string | null
          chave_acesso: string | null
          cliente_id: string
          codigo_nbs: string | null
          codigo_tributacao: string | null
          competencia: string
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          cst_piscofins: string | null
          data_emissao: string
          descricao: string
          emitida_sistema: boolean
          emitindo_em: string | null
          enviada_em: string | null
          enviada_para: string | null
          erro_boleto: string | null
          erro_emissao: string | null
          erro_envio: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento'] | null
          gerando_boleto_em: string | null
          id: string
          importada_de: string | null
          iss_retido: boolean
          justificativa_substituicao: string | null
          lancamento_id: string | null
          motivo_cancelamento: string | null
          motivo_substituicao: string | null
          municipio_prestacao: string | null
          numero: string | null
          numero_dps: string | null
          observacoes: string | null
          pis_cofins_retidos: boolean
          serie_dps: string | null
          status: Database['public']['Enums']['status_nota_fiscal']
          substitui_nota_id: string | null
          tipo: Database['public']['Enums']['tipo_nota_fiscal']
          tp_imunidade: number | null
          tp_ret_piscofins: number | null
          trib_issqn: number | null
          valor_cofins: number | null
          valor_csll: number | null
          valor_inss: number | null
          valor_irrf: number | null
          valor_pis: number | null
          valor_servico: number
          vencimento: string | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_csll?: number | null
          aliquota_inss?: number | null
          aliquota_irrf?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          ambiente_nfse?: string | null
          arquivo_boleto_id?: string | null
          arquivo_cancelamento_id?: string | null
          arquivo_pdf_id?: string | null
          arquivo_xml_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          boleto_banco?: string | null
          boleto_cobranca_id?: string | null
          boleto_codigo_barras?: string | null
          boleto_consultado_em?: string | null
          boleto_gerado_em?: string | null
          boleto_linha_digitavel?: string | null
          boleto_na_emissao?: boolean
          boleto_nosso_numero?: string | null
          boleto_pix?: string | null
          boleto_situacao?: string | null
          boleto_valor?: number | null
          boleto_vencimento?: string | null
          cancelada_em?: string | null
          chave_acesso?: string | null
          cliente_id: string
          codigo_nbs?: string | null
          codigo_tributacao?: string | null
          competencia: string
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          cst_piscofins?: string | null
          data_emissao: string
          descricao: string
          emitida_sistema?: boolean
          emitindo_em?: string | null
          enviada_em?: string | null
          enviada_para?: string | null
          erro_boleto?: string | null
          erro_emissao?: string | null
          erro_envio?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          gerando_boleto_em?: string | null
          id?: string
          importada_de?: string | null
          iss_retido?: boolean
          justificativa_substituicao?: string | null
          lancamento_id?: string | null
          motivo_cancelamento?: string | null
          motivo_substituicao?: string | null
          municipio_prestacao?: string | null
          numero?: string | null
          numero_dps?: string | null
          observacoes?: string | null
          pis_cofins_retidos?: boolean
          serie_dps?: string | null
          status?: Database['public']['Enums']['status_nota_fiscal']
          substitui_nota_id?: string | null
          tipo: Database['public']['Enums']['tipo_nota_fiscal']
          tp_imunidade?: number | null
          tp_ret_piscofins?: number | null
          trib_issqn?: number | null
          valor_cofins?: number | null
          valor_csll?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_pis?: number | null
          valor_servico: number
          vencimento?: string | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_csll?: number | null
          aliquota_inss?: number | null
          aliquota_irrf?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          ambiente_nfse?: string | null
          arquivo_boleto_id?: string | null
          arquivo_cancelamento_id?: string | null
          arquivo_pdf_id?: string | null
          arquivo_xml_id?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          boleto_banco?: string | null
          boleto_cobranca_id?: string | null
          boleto_codigo_barras?: string | null
          boleto_consultado_em?: string | null
          boleto_gerado_em?: string | null
          boleto_linha_digitavel?: string | null
          boleto_na_emissao?: boolean
          boleto_nosso_numero?: string | null
          boleto_pix?: string | null
          boleto_situacao?: string | null
          boleto_valor?: number | null
          boleto_vencimento?: string | null
          cancelada_em?: string | null
          chave_acesso?: string | null
          cliente_id?: string
          codigo_nbs?: string | null
          codigo_tributacao?: string | null
          competencia?: string
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          cst_piscofins?: string | null
          data_emissao?: string
          descricao?: string
          emitida_sistema?: boolean
          emitindo_em?: string | null
          enviada_em?: string | null
          enviada_para?: string | null
          erro_boleto?: string | null
          erro_emissao?: string | null
          erro_envio?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento'] | null
          gerando_boleto_em?: string | null
          id?: string
          importada_de?: string | null
          iss_retido?: boolean
          justificativa_substituicao?: string | null
          lancamento_id?: string | null
          motivo_cancelamento?: string | null
          motivo_substituicao?: string | null
          municipio_prestacao?: string | null
          numero?: string | null
          numero_dps?: string | null
          observacoes?: string | null
          pis_cofins_retidos?: boolean
          serie_dps?: string | null
          status?: Database['public']['Enums']['status_nota_fiscal']
          substitui_nota_id?: string | null
          tipo?: Database['public']['Enums']['tipo_nota_fiscal']
          tp_imunidade?: number | null
          tp_ret_piscofins?: number | null
          trib_issqn?: number | null
          valor_cofins?: number | null
          valor_csll?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_pis?: number | null
          valor_servico?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notas_fiscais_arquivo_boleto_id_fkey'
            columns: ['arquivo_boleto_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_arquivo_cancelamento_id_fkey'
            columns: ['arquivo_cancelamento_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_arquivo_pdf_id_fkey'
            columns: ['arquivo_pdf_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_arquivo_xml_id_fkey'
            columns: ['arquivo_xml_id']
            isOneToOne: false
            referencedRelation: 'arquivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_contrato_id_fkey'
            columns: ['contrato_id']
            isOneToOne: false
            referencedRelation: 'contratos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_lancamento_id_fkey'
            columns: ['lancamento_id']
            isOneToOne: false
            referencedRelation: 'v_lancamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_fiscais_substitui_nota_id_fkey'
            columns: ['substitui_nota_id']
            isOneToOne: false
            referencedRelation: 'notas_fiscais'
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
          nome_comercial: string | null
          os_id: string
          principio_ativo: string
          produto_id: string | null
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
          nome_comercial?: string | null
          os_id: string
          principio_ativo: string
          produto_id?: string | null
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
          nome_comercial?: string | null
          os_id?: string
          principio_ativo?: string
          produto_id?: string | null
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
          {
            foreignKeyName: 'os_produtos_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos_certificado'
            referencedColumns: ['id']
          },
        ]
      }
      perfis: {
        Row: {
          atende_whatsapp: boolean
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
          atende_whatsapp?: boolean
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
          atende_whatsapp?: boolean
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
      preferencias_notificacao: {
        Row: {
          apenas_minhas: boolean
          ativo: boolean
          atualizado_em: string
          mostrar_previa: boolean
          usuario_id: string
        }
        Insert: {
          apenas_minhas?: boolean
          ativo?: boolean
          atualizado_em?: string
          mostrar_previa?: boolean
          usuario_id?: string
        }
        Update: {
          apenas_minhas?: boolean
          ativo?: boolean
          atualizado_em?: string
          mostrar_previa?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preferencias_notificacao_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: true
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      produtos_certificado: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          fabricacao: string | null
          id: string
          lote: string | null
          nome_comercial: string | null
          principio_ativo: string
          quantidade_padrao: string | null
          registro: string | null
          validade: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          fabricacao?: string | null
          id?: string
          lote?: string | null
          nome_comercial?: string | null
          principio_ativo: string
          quantidade_padrao?: string | null
          registro?: string | null
          validade?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          fabricacao?: string | null
          id?: string
          lote?: string | null
          nome_comercial?: string | null
          principio_ativo?: string
          quantidade_padrao?: string | null
          registro?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'produtos_certificado_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'produtos_certificado_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
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
      push_enviados: {
        Row: {
          enviado_em: string
          inscricao_id: string
          mensagem_id: string
        }
        Insert: {
          enviado_em?: string
          inscricao_id: string
          mensagem_id: string
        }
        Update: {
          enviado_em?: string
          inscricao_id?: string
          mensagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_enviados_inscricao_id_fkey'
            columns: ['inscricao_id']
            isOneToOne: false
            referencedRelation: 'push_inscricoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'push_enviados_mensagem_id_fkey'
            columns: ['mensagem_id']
            isOneToOne: false
            referencedRelation: 'wa_mensagens'
            referencedColumns: ['id']
          },
        ]
      }
      push_inscricoes: {
        Row: {
          auth: string
          criado_em: string
          dispositivo: string | null
          endpoint: string
          id: string
          p256dh: string
          ultimo_acesso_em: string
          ultimo_envio_em: string | null
          ultimo_erro: string | null
          usuario_id: string
        }
        Insert: {
          auth: string
          criado_em?: string
          dispositivo?: string | null
          endpoint: string
          id?: string
          p256dh: string
          ultimo_acesso_em?: string
          ultimo_envio_em?: string | null
          ultimo_erro?: string | null
          usuario_id?: string
        }
        Update: {
          auth?: string
          criado_em?: string
          dispositivo?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          ultimo_acesso_em?: string
          ultimo_envio_em?: string | null
          ultimo_erro?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_inscricoes_usuario_id_fkey'
            columns: ['usuario_id']
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
          fotos_antes_depois: boolean
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
          fotos_antes_depois?: boolean
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
          fotos_antes_depois?: boolean
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
      wa_contatos: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          criado_em: string
          id: string
          nome_perfil: string | null
          wa_id: string
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          id?: string
          nome_perfil?: string | null
          wa_id: string
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          id?: string
          nome_perfil?: string | null
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wa_contatos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
        ]
      }
      wa_conversa_etiquetas: {
        Row: {
          conversa_id: string
          etiqueta_id: string
        }
        Insert: {
          conversa_id: string
          etiqueta_id: string
        }
        Update: {
          conversa_id?: string
          etiqueta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wa_conversa_etiquetas_conversa_id_fkey'
            columns: ['conversa_id']
            isOneToOne: false
            referencedRelation: 'wa_conversas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_conversa_etiquetas_etiqueta_id_fkey'
            columns: ['etiqueta_id']
            isOneToOne: false
            referencedRelation: 'wa_etiquetas'
            referencedColumns: ['id']
          },
        ]
      }
      wa_conversas: {
        Row: {
          contato_id: string
          criado_em: string
          finalizada_em: string | null
          id: string
          nao_lidas: number
          numero_id: string
          responsavel_id: string | null
          setor: Database['public']['Enums']['setor_atendimento'] | null
          status: Database['public']['Enums']['status_conversa']
          ultima_entrada_em: string | null
          ultima_mensagem_em: string | null
          ultima_mensagem_previa: string | null
          ultimo_responsavel_id: string | null
        }
        Insert: {
          contato_id: string
          criado_em?: string
          finalizada_em?: string | null
          id?: string
          nao_lidas?: number
          numero_id: string
          responsavel_id?: string | null
          setor?: Database['public']['Enums']['setor_atendimento'] | null
          status?: Database['public']['Enums']['status_conversa']
          ultima_entrada_em?: string | null
          ultima_mensagem_em?: string | null
          ultima_mensagem_previa?: string | null
          ultimo_responsavel_id?: string | null
        }
        Update: {
          contato_id?: string
          criado_em?: string
          finalizada_em?: string | null
          id?: string
          nao_lidas?: number
          numero_id?: string
          responsavel_id?: string | null
          setor?: Database['public']['Enums']['setor_atendimento'] | null
          status?: Database['public']['Enums']['status_conversa']
          ultima_entrada_em?: string | null
          ultima_mensagem_em?: string | null
          ultima_mensagem_previa?: string | null
          ultimo_responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'wa_conversas_contato_id_fkey'
            columns: ['contato_id']
            isOneToOne: false
            referencedRelation: 'wa_contatos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_conversas_numero_id_fkey'
            columns: ['numero_id']
            isOneToOne: false
            referencedRelation: 'wa_numeros'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_conversas_responsavel_id_fkey'
            columns: ['responsavel_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_conversas_ultimo_responsavel_id_fkey'
            columns: ['ultimo_responsavel_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      wa_etiquetas: {
        Row: {
          cor: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      wa_eventos: {
        Row: {
          corpo: Json
          erro: string | null
          hash: string
          id: string
          processado_em: string | null
          recebido_em: string
          tentativas: number
        }
        Insert: {
          corpo: Json
          erro?: string | null
          hash: string
          id?: string
          processado_em?: string | null
          recebido_em?: string
          tentativas?: number
        }
        Update: {
          corpo?: Json
          erro?: string | null
          hash?: string
          id?: string
          processado_em?: string | null
          recebido_em?: string
          tentativas?: number
        }
        Relationships: []
      }
      wa_mensagens: {
        Row: {
          conversa_id: string
          criado_em: string
          direcao: string
          enviada_em: string
          enviada_por: string | null
          erro: string | null
          id: string
          midia_caminho: string | null
          midia_id: string | null
          midia_mime: string | null
          midia_nome: string | null
          midia_tamanho: number | null
          responde_wamid: string | null
          status: Database['public']['Enums']['status_mensagem']
          status_em: string | null
          texto: string | null
          tipo: string
          wamid: string | null
        }
        Insert: {
          conversa_id: string
          criado_em?: string
          direcao: string
          enviada_em?: string
          enviada_por?: string | null
          erro?: string | null
          id?: string
          midia_caminho?: string | null
          midia_id?: string | null
          midia_mime?: string | null
          midia_nome?: string | null
          midia_tamanho?: number | null
          responde_wamid?: string | null
          status: Database['public']['Enums']['status_mensagem']
          status_em?: string | null
          texto?: string | null
          tipo: string
          wamid?: string | null
        }
        Update: {
          conversa_id?: string
          criado_em?: string
          direcao?: string
          enviada_em?: string
          enviada_por?: string | null
          erro?: string | null
          id?: string
          midia_caminho?: string | null
          midia_id?: string | null
          midia_mime?: string | null
          midia_nome?: string | null
          midia_tamanho?: number | null
          responde_wamid?: string | null
          status?: Database['public']['Enums']['status_mensagem']
          status_em?: string | null
          texto?: string | null
          tipo?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'wa_mensagens_conversa_id_fkey'
            columns: ['conversa_id']
            isOneToOne: false
            referencedRelation: 'wa_conversas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_mensagens_enviada_por_fkey'
            columns: ['enviada_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      wa_notas: {
        Row: {
          autor_id: string
          conversa_id: string
          criado_em: string
          id: string
          texto: string
        }
        Insert: {
          autor_id?: string
          conversa_id: string
          criado_em?: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          conversa_id?: string
          criado_em?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wa_notas_autor_id_fkey'
            columns: ['autor_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_notas_conversa_id_fkey'
            columns: ['conversa_id']
            isOneToOne: false
            referencedRelation: 'wa_conversas'
            referencedColumns: ['id']
          },
        ]
      }
      wa_numeros: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          numero_exibicao: string
          phone_number_id: string
          waba_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          numero_exibicao: string
          phone_number_id: string
          waba_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          numero_exibicao?: string
          phone_number_id?: string
          waba_id?: string
        }
        Relationships: []
      }
      wa_transferencias: {
        Row: {
          conversa_id: string
          em: string
          feita_por: string | null
          id: string
          motivo: string | null
          responsavel_anterior: string | null
          responsavel_novo: string | null
          setor: Database['public']['Enums']['setor_atendimento'] | null
        }
        Insert: {
          conversa_id: string
          em?: string
          feita_por?: string | null
          id?: string
          motivo?: string | null
          responsavel_anterior?: string | null
          responsavel_novo?: string | null
          setor?: Database['public']['Enums']['setor_atendimento'] | null
        }
        Update: {
          conversa_id?: string
          em?: string
          feita_por?: string | null
          id?: string
          motivo?: string | null
          responsavel_anterior?: string | null
          responsavel_novo?: string | null
          setor?: Database['public']['Enums']['setor_atendimento'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'wa_transferencias_conversa_id_fkey'
            columns: ['conversa_id']
            isOneToOne: false
            referencedRelation: 'wa_conversas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_transferencias_feita_por_fkey'
            columns: ['feita_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_transferencias_responsavel_anterior_fkey'
            columns: ['responsavel_anterior']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wa_transferencias_responsavel_novo_fkey'
            columns: ['responsavel_novo']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v_lancamentos: {
        Row: {
          antecipacao_id: string | null
          atrasado: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          cartao_credito_id: string | null
          categoria_id: string | null
          cliente_id: string | null
          competencia: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_compra: string | null
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
          recorrente_id: string | null
          servico_id: string | null
          situacao: string | null
          status: Database['public']['Enums']['status_lancamento'] | null
          tipo: Database['public']['Enums']['tipo_lancamento'] | null
          valor: number | null
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          antecipacao_id?: string | null
          atrasado?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          cartao_credito_id?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          competencia?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_compra?: string | null
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
          recorrente_id?: string | null
          servico_id?: string | null
          situacao?: never
          status?: Database['public']['Enums']['status_lancamento'] | null
          tipo?: Database['public']['Enums']['tipo_lancamento'] | null
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          antecipacao_id?: string | null
          atrasado?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          cartao_credito_id?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          competencia?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_compra?: string | null
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
          recorrente_id?: string | null
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
            foreignKeyName: 'lancamentos_antecipacao_id_fkey'
            columns: ['antecipacao_id']
            isOneToOne: false
            referencedRelation: 'antecipacoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lancamentos_cartao_credito_id_fkey'
            columns: ['cartao_credito_id']
            isOneToOne: false
            referencedRelation: 'cartoes_credito'
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
            foreignKeyName: 'lancamentos_recorrente_id_fkey'
            columns: ['recorrente_id']
            isOneToOne: false
            referencedRelation: 'lancamentos_recorrentes'
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
          origem: string | null
          valor_com_sinal: number | null
        }
        Relationships: []
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
      v_saldos_investimentos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          criado_em: string | null
          criado_por: string | null
          data_saldo_inicial: string | null
          id: string | null
          instituicao: string | null
          nome: string | null
          saldo_atual: number | null
          saldo_inicial: number | null
          total_aportado: number | null
          total_rendimento: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'investimentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'investimentos_criado_por_fkey'
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
      antecipar_recebiveis: {
        Args: {
          p_conta: string
          p_data: string
          p_desconto: number
          p_instituicao: string
          p_lancamentos: string[]
          p_observacoes?: string
        }
        Returns: string
      }
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
      crm_assumir: { Args: { conversa: string }; Returns: undefined }
      crm_atualizar_status: {
        Args: {
          p_em: string
          p_erro: string
          p_status: Database['public']['Enums']['status_mensagem']
          p_wamid: string
        }
        Returns: undefined
      }
      crm_destinatarios_push: {
        Args: { p_conversa: string }
        Returns: {
          auth: string
          endpoint: string
          inscricao_id: string
          mostrar_previa: boolean
          nao_lidas_total: number
          p256dh: string
          usuario_id: string
        }[]
      }
      crm_marcar_lida: { Args: { conversa: string }; Returns: undefined }
      crm_receber_mensagem: {
        Args: {
          p_enviada_em: string
          p_midia_id: string
          p_midia_mime: string
          p_midia_nome: string
          p_nome_perfil: string
          p_phone_number_id: string
          p_responde_wamid: string
          p_texto: string
          p_tipo: string
          p_wa_id: string
          p_wamid: string
        }
        Returns: {
          conversa_id: string
          mensagem_id: string
          nova: boolean
        }[]
      }
      crm_registrar_aparelho: {
        Args: {
          p_auth: string
          p_dispositivo: string
          p_endpoint: string
          p_p256dh: string
        }
        Returns: string
      }
      crm_registrar_envio: {
        Args: {
          p_conversa: string
          p_midia_caminho: string
          p_midia_mime: string
          p_midia_nome: string
          p_midia_tamanho: number
          p_texto: string
          p_tipo: string
          p_usuario: string
        }
        Returns: string
      }
      crm_remover_aparelho: { Args: { p_endpoint: string }; Returns: undefined }
      crm_status: {
        Args: {
          conversa: string
          novo_status: Database['public']['Enums']['status_conversa']
        }
        Returns: undefined
      }
      crm_transferir: {
        Args: {
          conversa: string
          motivo?: string
          novo_setor?: Database['public']['Enums']['setor_atendimento']
          responsavel: string
        }
        Returns: undefined
      }
      crm_vincular_cliente: {
        Args: { cliente: string; conversa: string }
        Returns: undefined
      }
      desfazer_antecipacao: {
        Args: { p_antecipacao: string }
        Returns: undefined
      }
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
      reservar_numero_dps: {
        Args: { p_ambiente: string; p_nota_id: string; p_serie: string }
        Returns: {
          numero: string
          serie: string
        }[]
      }
      resumo_mensal: {
        Args: { meses_antes?: number; meses_depois?: number }
        Returns: {
          despesas: number
          faturamento: number
          fluxo: number
          investido: number
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
      travar_boleto_nota: { Args: { p_nota_id: string }; Returns: boolean }
      travar_emissao_nota: { Args: { p_nota_id: string }; Returns: boolean }
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
        | 'boleto'
      forma_pagamento:
        'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'debito_automatico' | 'outro'
      formulario_os: 'generico' | 'pragas' | 'coifa'
      papel: 'admin' | 'financeiro' | 'vendedor' | 'recepcao' | 'operador' | 'administrativo'
      setor_atendimento: 'administrativo' | 'comercial' | 'financeiro' | 'operacional'
      status_comissao: 'prevista' | 'paga' | 'cancelada'
      status_contrato: 'ativo' | 'suspenso' | 'encerrado'
      status_conversa: 'aberta' | 'pendente' | 'finalizada'
      status_fechamento: 'aberto' | 'pago'
      status_lancamento: 'pendente' | 'agendado' | 'realizado' | 'cancelado'
      status_mensagem: 'recebida' | 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falhou'
      status_nota_fiscal: 'rascunho' | 'emitida' | 'cancelada'
      status_os: 'rascunho' | 'agendada' | 'em_execucao' | 'concluida' | 'conferida' | 'cancelada'
      status_proposta: 'enviada' | 'aprovada' | 'recusada'
      status_servico: 'agendado' | 'realizado' | 'cancelado'
      tipo_categoria: 'receita' | 'despesa'
      tipo_conta: 'corrente' | 'poupanca' | 'caixa' | 'outro'
      tipo_lancamento: 'entrada' | 'saida'
      tipo_movimento_investimento: 'aporte' | 'resgate' | 'rendimento'
      tipo_nota_fiscal: 'contrato' | 'avulsa'
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
        'boleto',
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
      papel: ['admin', 'financeiro', 'vendedor', 'recepcao', 'operador', 'administrativo'],
      setor_atendimento: ['administrativo', 'comercial', 'financeiro', 'operacional'],
      status_comissao: ['prevista', 'paga', 'cancelada'],
      status_contrato: ['ativo', 'suspenso', 'encerrado'],
      status_conversa: ['aberta', 'pendente', 'finalizada'],
      status_fechamento: ['aberto', 'pago'],
      status_lancamento: ['pendente', 'agendado', 'realizado', 'cancelado'],
      status_mensagem: ['recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou'],
      status_nota_fiscal: ['rascunho', 'emitida', 'cancelada'],
      status_os: ['rascunho', 'agendada', 'em_execucao', 'concluida', 'conferida', 'cancelada'],
      status_proposta: ['enviada', 'aprovada', 'recusada'],
      status_servico: ['agendado', 'realizado', 'cancelado'],
      tipo_categoria: ['receita', 'despesa'],
      tipo_conta: ['corrente', 'poupanca', 'caixa', 'outro'],
      tipo_lancamento: ['entrada', 'saida'],
      tipo_movimento_investimento: ['aporte', 'resgate', 'rendimento'],
      tipo_nota_fiscal: ['contrato', 'avulsa'],
      tipo_pessoa: ['PF', 'PJ'],
      tipo_ponto: ['porta_isca', 'armadilha_luminosa', 'coifa'],
      tipo_vencimento: ['certificado', 'recomendacao'],
    },
  },
} as const

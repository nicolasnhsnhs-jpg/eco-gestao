export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
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
      contatos_cliente: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cargo: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          email: string | null
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
          complemento: string | null
          criado_em: string
          criado_por: string | null
          id: string
          logradouro: string
          numero: string | null
          principal: boolean
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
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          logradouro: string
          numero?: string | null
          principal?: boolean
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
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          logradouro?: string
          numero?: string | null
          principal?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonimizar_cliente: { Args: { cliente: string }; Returns: undefined }
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
      canal_atendimento: 'telefone' | 'whatsapp' | 'presencial' | 'email' | 'outro'
      papel: 'admin' | 'financeiro' | 'vendedor' | 'recepcao'
      tipo_pessoa: 'PF' | 'PJ'
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
      canal_atendimento: ['telefone', 'whatsapp', 'presencial', 'email', 'outro'],
      papel: ['admin', 'financeiro', 'vendedor', 'recepcao'],
      tipo_pessoa: ['PF', 'PJ'],
    },
  },
} as const

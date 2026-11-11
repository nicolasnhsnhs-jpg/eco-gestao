/** "S3 · IWP1170" (a sigla é a da agenda; a descrição só quando diz algo a mais). */
export function nomeVeiculo(v: { placa: string; descricao: string; sigla?: string | null }) {
  return [v.sigla, v.placa, v.descricao !== v.sigla ? v.descricao : null]
    .filter(Boolean)
    .join(' · ')
}

-- Nota fiscal em rascunho: montada pelo sistema no dia 1, conferida pelo financeiro e
-- só então emitida. Fica numa migração separada porque um valor novo de enum só pode
-- ser usado depois que a transação que o criou termina.
alter type public.status_nota_fiscal add value if not exists 'rascunho' before 'emitida';

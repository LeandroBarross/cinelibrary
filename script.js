// ============================================================
// CONFIGURAÇÃO DO SUPABASE
// Substitua pelos dados do SEU projeto (Project Settings > API)
// ============================================================
const SUPABASE_URL = 'https://fiqwwwiqdxgqqentxgrf.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcXd3d2lxZHhncXFlbnR4Z3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjU1NDcsImV4cCI6MjEwNTE0MTU0N30.gAPreKtLtJuZh-29CJ20MpPbYrcvC5A99nRBFxQs96k';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
const TABLE_NAME = 'filmes';

// ============================================================
// ESTADO
// ============================================================
let filmes = [];
let filmeEditandoId = null;
let filmeParaExcluirId = null;

// ============================================================
// ELEMENTOS
// ============================================================
const catalogGrid = document.getElementById('catalog-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');

const searchInput = document.getElementById('search-input');
const genreFilter = document.getElementById('genre-filter');
const sortSelect = document.getElementById('sort-select');

const formModalOverlay = document.getElementById('form-modal-overlay');
const movieForm = document.getElementById('movie-form');
const modalTitle = document.getElementById('modal-title');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

const detailModalOverlay = document.getElementById('detail-modal-overlay');
const confirmModalOverlay = document.getElementById('confirm-modal-overlay');

const toast = document.getElementById('toast');

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  carregarFilmes();
  configurarEventos();
});

function configurarEventos() {
  document.getElementById('open-add-modal').addEventListener('click', () => abrirModalAdicionar());
  document.getElementById('empty-add-btn').addEventListener('click', () => abrirModalAdicionar());
  document.getElementById('close-form-modal').addEventListener('click', fecharModalFormulario);
  document.getElementById('cancel-form-btn').addEventListener('click', fecharModalFormulario);
  formModalOverlay.addEventListener('click', (e) => { if (e.target === formModalOverlay) fecharModalFormulario(); });

  document.getElementById('close-detail-modal').addEventListener('click', fecharModalDetalhe);
  detailModalOverlay.addEventListener('click', (e) => { if (e.target === detailModalOverlay) fecharModalDetalhe(); });

  document.getElementById('confirm-cancel-btn').addEventListener('click', fecharModalConfirmacao);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmarExclusao);
  confirmModalOverlay.addEventListener('click', (e) => { if (e.target === confirmModalOverlay) fecharModalConfirmacao(); });

  movieForm.addEventListener('submit', salvarFilme);

  searchInput.addEventListener('input', renderizarCatalogo);
  genreFilter.addEventListener('change', renderizarCatalogo);
  sortSelect.addEventListener('change', renderizarCatalogo);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharModalFormulario();
      fecharModalDetalhe();
      fecharModalConfirmacao();
    }
  });
}

// ============================================================
// CRUD — READ (consultar dados no Supabase)
// ============================================================
async function carregarFilmes() {
  loadingState.hidden = false;
  emptyState.hidden = true;

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select('*')
    .order('criado_em', { ascending: false });

  loadingState.hidden = true;

  if (error) {
    mostrarToast('Não foi possível carregar os filmes. Verifique a conexão com o Supabase.', true);
    console.error(error);
    return;
  }

  filmes = data || [];
  atualizarFiltroGeneros();
  atualizarEstatisticas();
  renderizarCatalogo();
}

// ============================================================
// CRUD — CREATE e UPDATE (cadastrar e alterar dados)
// ============================================================
async function salvarFilme(e) {
  e.preventDefault();
  formError.hidden = true;

  const titulo = document.getElementById('input-titulo').value.trim();
  if (!titulo) {
    exibirErroFormulario('O título é obrigatório.');
    return;
  }

  const payload = {
    titulo: titulo,
    ano_lancamento: valorNumericoOuNulo('input-ano'),
    genero: valorTextoOuNulo('input-genero'),
    diretor: valorTextoOuNulo('input-diretor'),
    elenco: valorTextoOuNulo('input-elenco'),
    sinopse: valorTextoOuNulo('input-sinopse'),
    nota: valorNumericoOuNulo('input-nota'),
    poster_url: valorTextoOuNulo('input-poster'),
    duracao_minutos: valorNumericoOuNulo('input-duracao'),
    classificacao: valorTextoOuNulo('input-classificacao'),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  let error;
  if (filmeEditandoId) {
    ({ error } = await supabaseClient.from(TABLE_NAME).update(payload).eq('id', filmeEditandoId));
  } else {
    ({ error } = await supabaseClient.from(TABLE_NAME).insert([payload]));
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Salvar filme';

  if (error) {
    exibirErroFormulario('Não foi possível salvar o filme. Tente novamente.');
    console.error(error);
    return;
  }

  mostrarToast(filmeEditandoId ? 'Filme atualizado com sucesso.' : 'Filme adicionado ao catálogo.');
  fecharModalFormulario();
  await carregarFilmes();
}

// ============================================================
// CRUD — DELETE (excluir dados)
// ============================================================
function pedirExclusao(id) {
  const filme = filmes.find((f) => f.id === id);
  if (!filme) return;
  filmeParaExcluirId = id;
  document.getElementById('confirm-movie-title').textContent = filme.titulo;
  confirmModalOverlay.hidden = false;
}

async function confirmarExclusao() {
  if (!filmeParaExcluirId) return;

  const { error } = await supabaseClient.from(TABLE_NAME).delete().eq('id', filmeParaExcluirId);

  fecharModalConfirmacao();
  fecharModalDetalhe();

  if (error) {
    mostrarToast('Não foi possível excluir o filme.', true);
    console.error(error);
    return;
  }

  mostrarToast('Filme removido do catálogo.');
  await carregarFilmes();
}

// ============================================================
// RENDERIZAÇÃO
// ============================================================
function renderizarCatalogo() {
  const termo = searchInput.value.trim().toLowerCase();
  const genero = genreFilter.value;
  const ordenacao = sortSelect.value;

  let lista = filmes.filter((f) => {
    const combinaBusca = !termo ||
      f.titulo.toLowerCase().includes(termo) ||
      (f.diretor && f.diretor.toLowerCase().includes(termo));
    const combinaGenero = !genero || f.genero === genero;
    return combinaBusca && combinaGenero;
  });

  lista = ordenarFilmes(lista, ordenacao);

  catalogGrid.innerHTML = '';

  if (filmes.length === 0) {
    emptyState.hidden = false;
    noResultsState.hidden = true;
    return;
  }
  emptyState.hidden = true;

  if (lista.length === 0) {
    noResultsState.hidden = false;
    return;
  }
  noResultsState.hidden = true;

  lista.forEach((filme) => catalogGrid.appendChild(criarCardFilme(filme)));
}

function ordenarFilmes(lista, criterio) {
  const copia = [...lista];
  switch (criterio) {
    case 'rating-desc':
      return copia.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
    case 'year-desc':
      return copia.sort((a, b) => (b.ano_lancamento ?? 0) - (a.ano_lancamento ?? 0));
    case 'year-asc':
      return copia.sort((a, b) => (a.ano_lancamento ?? 9999) - (b.ano_lancamento ?? 9999));
    case 'title-asc':
      return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    default:
      return copia;
  }
}

function criarCardFilme(filme) {
  const card = document.createElement('article');
  card.className = 'movie-card';
  card.addEventListener('click', () => abrirModalDetalhe(filme.id));

  const meta = [filme.ano_lancamento, formatarDuracao(filme.duracao_minutos), filme.classificacao]
    .filter(Boolean)
    .join(' · ');

  card.innerHTML = `
    <div class="card-poster">
      ${filme.poster_url
        ? `<img src="${escapeHtml(filme.poster_url)}" alt="Pôster de ${escapeHtml(filme.titulo)}" loading="lazy" onerror="this.replaceWith(criarFallbackPoster())">`
        : renderFallbackPosterHtml()}
      ${filme.nota != null ? `<span class="card-rating">${Number(filme.nota).toFixed(1)}</span>` : ''}
      <div class="card-actions">
        <button class="card-action-btn edit" title="Editar" aria-label="Editar filme">
          <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="card-action-btn delete" title="Excluir" aria-label="Excluir filme">
          <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
    <div class="card-body">
      ${filme.genero ? `<p class="card-genre">${escapeHtml(filme.genero)}</p>` : ''}
      <h3 class="card-title">${escapeHtml(filme.titulo)}</h3>
      ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
    </div>
  `;

  card.querySelector('.card-action-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    abrirModalEditar(filme.id);
  });
  card.querySelector('.card-action-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    pedirExclusao(filme.id);
  });

  return card;
}

function renderFallbackPosterHtml() {
  return `<div class="poster-fallback"><svg viewBox="0 0 48 48" fill="none" width="32" height="32"><rect x="6" y="10" width="36" height="28" rx="2" stroke="currentColor" stroke-width="2"/><path d="M6 16h36" stroke="currentColor" stroke-width="2"/></svg></div>`;
}
function criarFallbackPoster() {
  const div = document.createElement('div');
  div.className = 'poster-fallback';
  div.innerHTML = renderFallbackPosterHtml().match(/<svg[\s\S]*<\/svg>/)[0];
  return div;
}

function atualizarFiltroGeneros() {
  const generosUnicos = [...new Set(filmes.map((f) => f.genero).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const valorAtual = genreFilter.value;
  genreFilter.innerHTML = '<option value="">Todos os gêneros</option>';
  generosUnicos.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    genreFilter.appendChild(opt);
  });
  genreFilter.value = generosUnicos.includes(valorAtual) ? valorAtual : '';
}

function atualizarEstatisticas() {
  document.getElementById('stat-total').textContent = filmes.length;

  const notas = filmes.map((f) => f.nota).filter((n) => n != null);
  const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '—';
  document.getElementById('stat-avg').textContent = media;

  const generos = new Set(filmes.map((f) => f.genero).filter(Boolean));
  document.getElementById('stat-genres').textContent = generos.size;
}

// ============================================================
// MODAL — FORMULÁRIO (adicionar / editar)
// ============================================================
function abrirModalAdicionar() {
  filmeEditandoId = null;
  modalTitle.textContent = 'Adicionar filme';
  submitBtn.textContent = 'Salvar filme';
  movieForm.reset();
  formError.hidden = true;
  formModalOverlay.hidden = false;
  document.getElementById('input-titulo').focus();
}

function abrirModalEditar(id) {
  const filme = filmes.find((f) => f.id === id);
  if (!filme) return;

  filmeEditandoId = id;
  modalTitle.textContent = 'Editar filme';
  submitBtn.textContent = 'Salvar alterações';
  formError.hidden = true;

  document.getElementById('input-titulo').value = filme.titulo || '';
  document.getElementById('input-ano').value = filme.ano_lancamento ?? '';
  document.getElementById('input-duracao').value = filme.duracao_minutos ?? '';
  document.getElementById('input-genero').value = filme.genero || '';
  document.getElementById('input-classificacao').value = filme.classificacao || '';
  document.getElementById('input-diretor').value = filme.diretor || '';
  document.getElementById('input-nota').value = filme.nota ?? '';
  document.getElementById('input-elenco').value = filme.elenco || '';
  document.getElementById('input-poster').value = filme.poster_url || '';
  document.getElementById('input-sinopse').value = filme.sinopse || '';

  formModalOverlay.hidden = false;
}

function fecharModalFormulario() {
  formModalOverlay.hidden = true;
  filmeEditandoId = null;
}

function exibirErroFormulario(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

// ============================================================
// MODAL — DETALHE
// ============================================================
function abrirModalDetalhe(id) {
  const filme = filmes.find((f) => f.id === id);
  if (!filme) return;

  document.getElementById('detail-title').textContent = filme.titulo;
  document.getElementById('detail-genre').textContent = filme.genero || '';
  document.getElementById('detail-genre').hidden = !filme.genero;

  const meta = [filme.ano_lancamento, formatarDuracao(filme.duracao_minutos), filme.classificacao].filter(Boolean).join(' · ');
  document.getElementById('detail-meta').textContent = meta;

  const ratingEl = document.getElementById('detail-rating');
  ratingEl.innerHTML = filme.nota != null
    ? `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg> ${Number(filme.nota).toFixed(1)} / 10`
    : '';

  document.getElementById('detail-synopsis').textContent = filme.sinopse || 'Sinopse não cadastrada.';

  const posterImg = document.getElementById('detail-poster-img');
  posterImg.src = filme.poster_url || '';
  posterImg.alt = `Pôster de ${filme.titulo}`;
  posterImg.onerror = () => { posterImg.style.display = 'none'; };
  posterImg.style.display = filme.poster_url ? 'block' : 'none';

  const facts = document.getElementById('detail-facts');
  facts.innerHTML = '';
  if (filme.diretor) facts.innerHTML += `<dt>Direção</dt><dd>${escapeHtml(filme.diretor)}</dd>`;
  if (filme.elenco) facts.innerHTML += `<dt>Elenco</dt><dd>${escapeHtml(filme.elenco)}</dd>`;

  document.getElementById('detail-edit-btn').onclick = () => { fecharModalDetalhe(); abrirModalEditar(id); };
  document.getElementById('detail-delete-btn').onclick = () => pedirExclusao(id);

  detailModalOverlay.hidden = false;
}

function fecharModalDetalhe() {
  detailModalOverlay.hidden = true;
}

// ============================================================
// MODAL — CONFIRMAÇÃO DE EXCLUSÃO
// ============================================================
function fecharModalConfirmacao() {
  confirmModalOverlay.hidden = true;
  filmeParaExcluirId = null;
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function valorTextoOuNulo(id) {
  const v = document.getElementById(id).value.trim();
  return v === '' ? null : v;
}
function valorNumericoOuNulo(id) {
  const v = document.getElementById(id).value;
  return v === '' ? null : Number(v);
}
function formatarDuracao(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function mostrarToast(msg, isError = false) {
  toast.textContent = msg;
  toast.className = isError ? 'toast error' : 'toast';
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 3500);
}

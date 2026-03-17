# PRD - Espaço Girafinha Website

## Declaração do Problema Original
Criar um website moderno, colorido e responsivo de página única para um espaço de festas infantis chamado "Espaço Girafinha" localizado em Silves, Algarve, Portugal. O design deve ser inspirado no Instagram da marca - divertido, colorido, amigável para crianças, com tons suaves e elementos divertidos.

## Informações do Cliente
- **Nome**: Espaço Girafinha
- **Localização**: Silves, Algarve, Portugal
- **WhatsApp**: +351935541254
- **Instagram**: @espacogirafinha.silves
- **Facebook**: Girafinha Decoração
- **Público-alvo**: Pais que procuram um local para festas de aniversário infantis

## Arquitetura Técnica
- **Frontend**: React + Vite, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI + MongoDB (a implementar)
- **Hospedagem**: Emergent Platform
- **URL**: https://girafinha-silves.preview.emergentagent.com

## Personas de Utilizador
1. **Maria (Mãe, 35 anos)**
   - Procura um espaço seguro e divertido para o aniversário do filho
   - Quer ver fotos reais do espaço
   - Prefere contactar via WhatsApp
   - Valoriza pacotes completos sem preocupações

2. **João (Pai, 38 anos)**
   - Compara preços e pacotes
   - Quer informações claras sobre o que está incluído
   - Usa mobile para pesquisar
   - Valoriza avaliações de outros pais

## Requisitos Core (Estáticos)

### Layout de Página Única
1. **Hero Section**
   - Título: "Festas Infantis em Silves 🎉"
   - Subtítulo sobre diversão garantida
   - 2 CTAs: "Pedir Orçamento" e "Contactar"

2. **About Section**
   - Texto sobre o espaço ser seguro, privado e divertido
   - Menção a Silves e Algarve

3. **Party Packages**
   - Pack Simples (até 15 crianças)
   - Pack com Decoração (até 20 crianças) - Mais Popular
   - Pack Completo (até 25 crianças)
   - Aluguer do Espaço (flexível)

4. **Gallery**
   - Grid de fotos reais do espaço e festas

5. **Why Choose Us**
   - Ambiente Seguro
   - Espaço Privado
   - Atividades Divertidas
   - Sem Stress para os Pais

6. **Contact Section**
   - Formulário que redireciona para WhatsApp
   - Informações de contacto
   - Links para redes sociais

7. **Footer**
   - Logo e informações
   - Links de redes sociais

8. **WhatsApp Button Flutuante**
   - Fixo no canto inferior direito
   - Verde com ícone de mensagem

### Design Guidelines
- **Cores**: Laranja (#FFB347), Amarelo, Verde (#90C695), Rosa Pastel
- **Tipografia**: Poppins (arredondada e amigável)
- **Estilo**: Moderno, colorido, acolhedor
- **Ícones**: Lucide-react (não emojis)
- **Animações**: Suaves e discretas
- **Responsivo**: Mobile-first

## O Que Foi Implementado

### Data: 17 de Março de 2026

#### Frontend (Completo com Dados Mock)
✅ **Estrutura de Ficheiros**
- `/app/frontend/src/pages/Home.jsx` - Página principal
- `/app/frontend/src/data/mock.js` - Dados mock dos pacotes, galeria, funcionalidades
- `/app/frontend/src/App.js` - Routing atualizado
- `/app/frontend/src/index.css` - Estilos globais + fonte Poppins
- `/app/frontend/src/App.css` - Estilos customizados

✅ **Imagens Preparadas**
- Logo: `/app/frontend/public/Logotipo girafinha (1).png`
- Pacotes: Pack Simples, Pack com Decoração, Pack Completo, Aluguer do Espaço
- Galeria: 25 fotos reais de festas em `/app/frontend/public/gallery/`
- Hero: Imagem emocional de crianças em festa (Unsplash)

✅ **Funcionalidades Implementadas (Frontend)**
1. **Navegação Suave**: Links de âncora para secções
2. **Header Fixo**: Com logo e navegação
3. **Hero Section**: Com imagem de fundo emocional, headline otimizada e urgência
4. **About Section**: Texto emocional + estatísticas sociais (500+ festas, 100% satisfação, 5★)
5. **Packages Cards**: 4 pacotes com duração, descrições emocionais e urgência
6. **Gallery Grid**: 3x4 grid maior e mais engaging com CTAs
7. **Features Section**: 4 benefícios reescritos emocionalmente (2x2 layout)
8. **Contact Form**: Formulário otimizado que redireciona para WhatsApp
9. **Footer**: Com logo e links de redes sociais
10. **WhatsApp Floating Button**: Maior, mais verde e com pulse animation
11. **Responsive Design**: Funciona em mobile e desktop
12. **Smooth Scrolling**: Animações suaves

✅ **Integração WhatsApp**
- Formulário envia dados formatados via WhatsApp
- Botão flutuante com mensagem pré-definida
- Número: +351935541254

### Data: 17 de Março de 2026 (Tarde) - MELHORIAS DE CONVERSÃO

#### Otimizações Implementadas para Aumentar Conversões

✅ **Hero Section Otimizado**
- Nova headline emocional: "Festas infantis inesquecíveis em Silves 🎉"
- Subheadline focada em benefícios: "Diversão garantida para crianças e tranquilidade para os pais"
- Elemento de urgência destacado: "⚠️ Datas limitadas — reserve com antecedência"
- Imagem de fundo com crianças felizes (maior impacto emocional)
- Botões CTA maiores e com melhor contraste (orange-600/700)

✅ **About Section Emocional**
- Título impactante: "Transformamos aniversários em memórias inesquecíveis! ✨"
- Copy reescrito focando em criar memórias e eliminar stress dos pais
- **Social Proof adicionado**: 3 cards com estatísticas
  * 500+ Festas Realizadas
  * 100% Pais Satisfeitos
  * 5★ Avaliação Google
- Frase de encerramento emocional: "Mais do que um espaço de festas, somos parceiros na criação de sorrisos! 😊"

✅ **Packages Section Melhorado**
- **Urgência adicionada**: "⚠️ Disponibilidade limitada — garanta já a sua data!"
- **Duração visível**: "3 horas" em todos os pacotes
- Pack mais popular **visualmente destacado**:
  * Borda laranja mais forte (border-orange-500)
  * Badge "⭐ Mais Popular"
  * Escala ligeiramente maior (scale-105)
  * Sombra mais proeminente
  * Botão com cor mais forte (orange-600)
- Descrições emocionalmente otimizadas
- Lista de inclusões expandida e mais clara
- Botão CTA melhorado: "💬 Pedir Informações"

✅ **Gallery Engagement**
- Título mais emocional: "Galeria de Momentos Felizes"
- Ênfase em autenticidade: "Fotos reais das festas realizadas no nosso espaço — momentos inesquecíveis!"
- **Imagens maiores**: 3 colunas (era 4) para maior impacto
- Cantos mais arredondados (rounded-2xl)
- Overlay com descrição ao hover
- **CTA no final da galeria**: "Quer ver a sua festa aqui? 📸" + botão "Reserve Já a Sua Data"

✅ **Why Choose Us - Reescrito Emocionalmente**
- Benefícios reescritos focando em sentimentos e resultados:
  1. "Espaço seguro e adaptado para crianças" - com detalhes sobre supervisão
  2. "Ambiente privado para a sua festa" - exclusividade destacada
  3. "Diversão garantida com várias atividades" - mantém crianças felizes
  4. "Sem stress para os pais — tratamos de tudo" - foco em relaxamento
- Layout 2x2 (era 4 colunas) para permitir descrições mais longas
- Ícones maiores e mais proeminentes

✅ **Contact Section Otimizada**
- Título mais urgente: "Reserve a Festa dos Sonhos"
- **Urgência repetida**: "⚠️ Vagas limitadas — garanta já a sua data preferida!"
- **Caixa informativa**: "💡 Resposta rápida garantida! Respondemos em menos de 2 horas"
- Botão WhatsApp otimizado: "💬 Pedir Orçamento por WhatsApp"
- Botão maior (py-7) e mais verde (green-600/700) com sombra forte
- Placeholder do textarea mais descritivo e específico
- Nota explicativa sobre funcionamento do WhatsApp

✅ **WhatsApp Floating Button Melhorado**
- Tamanho aumentado (p-5, h-7 w-7)
- Cor mais forte e contrastante (green-600/700)
- **Animação pulse** para chamar atenção constantemente

✅ **Elementos de Urgência (SCARCITY)**
Urgência implementada em 3 pontos estratégicos:
1. Hero Section
2. Packages Section
3. Contact Section

✅ **Melhorias Globais de UX**
- Contraste aumentado em todos os botões
- Emotividade aumentada em todos os textos
- Foco em benefícios emocionais (não features técnicas)
- Social proof destacado (estatísticas)
- CTAs mais específicos e action-oriented
- Elementos visuais hierarquicamente organizados

## Backlog Priorizado

### P0 (Crítico - Próxima Fase)
- [ ] **Backend Development**
  - Modelos MongoDB para Pacotes, Contactos, Reservas
  - API endpoints para pacotes (/api/packages)
  - API endpoint para contactos (/api/contact)
  - API endpoint para consultas de disponibilidade
  - Integração com frontend (remover mock.js)

### P1 (Alta Prioridade)
- [ ] **Sistema de Reservas**
  - Calendário de disponibilidade
  - Sistema de reserva online
  - Confirmação por email/WhatsApp
- [ ] **Admin Dashboard**
  - Gestão de pacotes
  - Gestão de reservas
  - Visualização de contactos
- [ ] **SEO & Performance**
  - Meta tags otimizadas
  - Schema.org markup
  - Otimização de imagens
  - Google Analytics

### P2 (Melhorias Futuras)
- [ ] **Testemunhos de Clientes**
  - Secção de reviews
  - Integração com Google Reviews
- [ ] **Blog/Novidades**
  - Secção de notícias
  - Dicas para festas
- [ ] **Galeria Interativa**
  - Lightbox para fotos
  - Filtros por tema
- [ ] **Formulário de Orçamento Detalhado**
  - Seleção de pacote
  - Escolha de extras
  - Cálculo automático de preço
- [ ] **Multi-idioma**
  - Inglês para turistas
  - Troca de idioma

## Próximas Tarefas (Next Action Items)
1. **Aguardar feedback do utilizador** sobre o design e funcionalidades frontend
2. **Backend Development**: Criar API endpoints e integrar com MongoDB
3. **Testing**: Testes E2E de todos os fluxos
4. **Deploy**: Preparar para produção

## Notas Técnicas
- Frontend usa React Router para navegação
- Shadcn UI para componentes
- Tailwind CSS para styling
- Lucide-react para ícones
- Formulário redireciona para WhatsApp (sem envio de email por enquanto)
- Dados mock em `/app/frontend/src/data/mock.js`

## Links Importantes
- **Website**: https://girafinha-silves.preview.emergentagent.com
- **Instagram**: https://instagram.com/espacogirafinha.silves
- **Facebook**: https://www.facebook.com/p/Girafinha-decora%C3%A7%C3%A3o-61559630369569/

### Data: 17 de Março de 2026 (Noite) - REDESIGN MINIMALISTA DOS PACOTES

#### Secção de Pacotes Completamente Redesenhada

✅ **Design Minimalista Implementado**
- **Imagens removidas**: Cards agora são 100% texto e informação
- **Layout limpo**: Fundo branco, tipografia clara, espaçamento generoso
- **Zero clutter**: Focado apenas no essencial

✅ **Hierarquia Visual Clara (Top to Bottom)**
1. **Nome do Pacote**: Texto grande e bold (text-2xl)
2. **Preço**: Muito destacado em laranja grande (text-4xl)
   - Pack Simples: 220€
   - Pack com Decoração: 350€ (MAIS POPULAR)
   - Pack Completo: 500€
   - Aluguer do Espaço: 150€
3. **Quick Info com Ícones SVG**:
   - Ícone de pessoas + "Até X crianças"
   - Ícone de relógio + "3 horas"
4. **Descrição**: Curta e objetiva (1 linha)
5. **Divider**: Linha separadora
6. **Lista de Inclusões**: 
   - Título em uppercase "O QUE ESTÁ INCLUÍDO:"
   - Checkmarks verdes com texto descritivo
7. **CTA Button**: "💬 Pedir Orçamento" em laranja

✅ **Pack Popular Visualmente Destacado**
- Badge laranja no topo: "⭐ MAIS POPULAR"
- Borda mais forte (border-3 border-orange-500)
- Botão CTA com cor mais intensa (orange-600)
- Sombra mais proeminente

✅ **Scannable em < 5 Segundos**
- Preço imediatamente visível no topo
- Informação organizada verticalmente
- Ícones facilitam compreensão rápida
- Checkmarks verdes para leitura rápida da lista
- Sem elementos distrativos

✅ **Mobile-Optimized**
- Cards empilhados verticalmente (1 coluna)
- Toda informação visível sem scroll horizontal
- Botões grandes e fáceis de tocar (py-6)
- Espaçamento touch-friendly

✅ **Elementos Adicionais de Conversão**
- Caixa informativa no final da secção:
  * "💡 Precisa de algo personalizado?"
  * Texto explicativo sobre customização
  * Botão "Falar Connosco" (outline style)
- Reforça flexibilidade e atendimento personalizado

✅ **Melhorias UX**
- Cards com hover effect (-translate-y-1)
- Transições suaves (duration-300)
- Espaçamento consistente entre elementos
- Tipografia bem definida (text-sm, text-base, text-2xl, text-4xl)
- Cores consistentes com brand (orange-500/600, green-600, gray-700)

**Resultado**: Secção de pacotes extremamente clara, fácil de comparar e otimizada para conversão mobile e desktop.

### Data: 17 de Março de 2026 (Noite) - SECÇÃO DE TESTEMUNHOS REAIS ADICIONADA

#### Nova Secção: "O que dizem os pais"

✅ **Testemunhos Reais Implementados**
- **5 testemunhos** de clientes reais (Marta-Lagoa, Amanda-Tunes, Jéssica-Silves, Ana-Portimão, Tânia-Silves)
- Todos com **avaliação 5 estrelas**
- Textos **autênticos e emocionais** mantendo clareza e legibilidade
- Foco em experiências reais: decoração, comida, equipa, diversão das crianças

✅ **Design dos Cards de Testemunhos**
- **Fundo branco limpo** com borda cinza suave
- **5 estrelas laranjas** visíveis no topo de cada card
- **Ícone de aspas decorativo** (Quote icon) em laranja suave
- **Texto em itálico** com formato de citação ("...")
- **Divider horizontal** separando texto de autor
- **Nome do autor em bold** + localização em cinza
- **Hover effect**: borda muda para laranja e sombra aumenta

✅ **Layout e Grid**
- **Desktop**: Grid 3 colunas (lg:grid-cols-3)
- **Tablet**: Grid 2 colunas (md:grid-cols-2)
- **Mobile**: 1 coluna empilhada
- Espaçamento generoso (gap-8)
- Máximo 7xl container

✅ **Badge do Google Reviews**
- **Centralizado** abaixo dos testemunhos
- **Inline-flex** com fundo laranja suave (orange-50)
- **5 estrelas laranjas** + texto "5.0 no Google Reviews"
- Design arredondado (rounded-full)
- Borda laranja (border-2 border-orange-200)

✅ **Posicionamento Estratégico**
- Colocada **DEPOIS** de "Why Choose Us"
- Colocada **ANTES** de "Contact Section"
- Razão: Construir confiança máxima antes do pedido de contacto
- Fluxo: Features → Social Proof (Testemunhos) → Action (Contacto)

✅ **Social Proof Atualizado na Secção About**
- **Corrigido**: 500+ → **100+ Festas Realizadas**
- Mantido: **100% Pais Satisfeitos**
- Mantido: **5★ Avaliação Google**

✅ **Elementos de Autenticidade**
- Nomes reais dos clientes
- Localizações variadas (Algarve: Lagoa, Tunes, Silves, Portimão)
- Detalhes específicos mencionados (decoração, catering, equipa, carinho)
- Linguagem natural e emocional
- Foco em resultados (felicidade das crianças, tranquilidade dos pais)

✅ **Impacto de Conversão**
- **Trust Building**: 5 testemunhos de 5 estrelas constroem forte credibilidade
- **Regional Reach**: Localidades variadas mostram alcance no Algarve
- **Emotional Connection**: Foco em momentos especiais e memórias
- **Specific Benefits**: Menção a aspectos tangíveis (decoração, comida, equipa)
- **Google Reviews Badge**: Reforça avaliação pública verificável

**Resultado**: Secção de testemunhos que constrói confiança forte e conexão emocional genuína com potenciais clientes através de experiências reais autênticas.

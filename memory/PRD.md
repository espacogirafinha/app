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

✅ **Funcionalidades Implementadas (Frontend)**
1. **Navegação Suave**: Links de âncora para secções
2. **Header Fixo**: Com logo e navegação
3. **Hero Section**: Com gradientes suaves e CTAs
4. **About Section**: Texto informativo sobre o espaço
5. **Packages Cards**: 4 pacotes com imagens reais, descrições e botões CTA
6. **Gallery Grid**: 4x2 grid responsivo com efeitos hover
7. **Features Section**: 4 cards com ícones
8. **Contact Form**: Formulário que redireciona para WhatsApp
9. **Footer**: Com logo e links de redes sociais
10. **WhatsApp Floating Button**: Fixo e funcional
11. **Responsive Design**: Funciona em mobile e desktop
12. **Smooth Scrolling**: Animações suaves

✅ **Integração WhatsApp**
- Formulário envia dados formatados via WhatsApp
- Botão flutuante com mensagem pré-definida
- Número: +351935541254

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

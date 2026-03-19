// Mock data para Espaço Girafinha

export const packages = [
  {
    id: 1,
    name: "Pack Simples",
    price: "220€",
    schedules: [
      "Manhã: 10h – 13h",
      "Tarde: 16h – 19h"
    ],
    includes: [
      "Utilização exclusiva do espaço",
      "Insuflável, trampolim, piscina de bolas, brinquedos de imitação e outras atividades",
      "Monitor/animador",
      "Lanche para até 20 crianças"
    ],
    extras: [
      "Hora extra: +75€"
    ],
    notes: [
      "É permitido trazer comida, decoração e bolo de aniversário",
      "Reserva com pagamento de 20% do valor total",
      "Restante pagamento no dia do evento"
    ]
  },
  {
    id: 2,
    name: "Pack com Decoração",
    price: "350€",
    schedules: [
      "Manhã: 10h – 13h",
      "Tarde: 16h – 19h"
    ],
    includes: [
      "Utilização exclusiva do espaço",
      "Insuflável, trampolim, piscina de bolas, brinquedos de imitação e outras atividades",
      "Monitor/animador",
      "Lanche para até 20 crianças",
      "Decoração personalizada (tema à escolha)"
    ],
    extras: [
      "Hora extra: +75€"
    ],
    notes: [
      "É permitido trazer comida e bolo de aniversário",
      "Reserva com pagamento de 20% do valor total",
      "Restante pagamento no dia do evento"
    ],
    popular: true
  },
  {
    id: 3,
    name: "Pack Completo",
    price: "500€",
    schedules: [
      "Manhã: 10h – 13h",
      "Tarde: 16h – 19h"
    ],
    includes: [
      "Utilização exclusiva do espaço",
      "Insuflável, trampolim, piscina de bolas, brinquedos de imitação e outras atividades",
      "Monitor/animador",
      "Decoração personalizada (tema à escolha)",
      "Lanche para até 20 crianças",
      "Catering para até 30 adultos"
    ],
    extras: [
      "Bolo de aniversário (opcional): +50€"
    ],
    notes: [
      "É permitido trazer comida e bolo de aniversário",
      "Reserva com pagamento de 20% do valor total",
      "Restante pagamento no dia do evento"
    ]
  },
  {
    id: 4,
    name: "Aluguer do Espaço",
    price: "160€",
    schedules: [
      "Manhã: 10h – 13h",
      "Tarde: 16h – 19h"
    ],
    includes: [
      "Utilização exclusiva do espaço",
      "Área para bolo e catering",
      "Insuflável, trampolim, piscina de bolas, brinquedos de imitação e outras atividades",
      "Lotação máxima: 50 pessoas"
    ],
    extras: [
      "Hora extra: +75€"
    ],
    notes: [
      "É permitido trazer comida, decoração e bolo de aniversário",
      "Reserva com pagamento de 20% do valor total",
      "Restante pagamento no dia do evento",
      "Caução de 100€ (devolvida no final, caso não existam danos)"
    ]
  }
];

export const foodOptions = [
  {
    id: 1,
    name: "Lanche Crianças",
    includes: [
      "Pães de leite com fiambre e queijo",
      "Batatas fritas",
      "Gomas",
      "Pipocas",
      "Gelatina",
      "Bolo simples",
      "Água e sumo à descrição",
      "10 cápsulas de café"
    ]
  },
  {
    id: 2,
    name: "Catering Adultos + Lanche Crianças",
    subtitle: "Ideal até 20 crianças e 30 adultos",
    includes: [
      "Batatas fritas",
      "Gomas",
      "Pipocas",
      "Gelatina",
      "Bolo simples",
      "Água e sumo à descrição",
      "2 refrigerantes",
      "10 cápsulas de café",
      "Salgadinhos",
      "Mini pizzas",
      "Folhado misto XL",
      "Mix frutos secos",
      "Sandes variadas",
      "Fruta laminada",
      "Folhadinhos de chocolate",
      "Mini pastelaria variada"
    ]
  }
];

export const galleryImages = [
  { 
    id: 1, 
    src: "/gallery/piscina-bolas-turquesa.jpg", 
    alt: "Crianças brincando na piscina de bolas", 
    category: "Espaço & Crianças felizes" 
  },
  { 
    id: 2, 
    src: "/gallery/cozinha-brincar.jpg", 
    alt: "Crianças brincando na cozinha de brincar", 
    category: "Espaço & Crianças felizes" 
  },
  { 
    id: 3, 
    src: "/gallery/festa-aniversario.jpg", 
    alt: "Festa de aniversário com bolo", 
    category: "Espaço & Crianças felizes" 
  },
  { 
    id: 4, 
    src: "/gallery/piscina-bolas-amarela.jpg", 
    alt: "Criança feliz na piscina de bolas", 
    category: "Espaço & Crianças felizes" 
  },
  { 
    id: 5, 
    src: "/gallery/castelo-insuflavel.jpg", 
    alt: "Crianças brincando no castelo insuflável", 
    category: "Espaço & Crianças felizes" 
  },
  { 
    id: 6, 
    src: "/gallery/catering-folhado-fruta.jpg", 
    alt: "Folhados e fruta fresca para catering", 
    category: "Catering" 
  },
  { 
    id: 7, 
    src: "/gallery/catering-mini-pizzas-quiche.jpg", 
    alt: "Mini pizzas e quiches variadas", 
    category: "Catering" 
  },
  { 
    id: 8, 
    src: "/gallery/catering-charcutaria-queijos.jpg", 
    alt: "Charcutaria e queijos selecionados", 
    category: "Catering" 
  },
  { 
    id: 9, 
    src: "/gallery/catering-sandes-variadas.jpg", 
    alt: "Sandes variadas para adultos", 
    category: "Catering" 
  },
  { 
    id: 10, 
    src: "/gallery/catering-hotdogs-sandes.jpg", 
    alt: "Hotdogs e sandes para festas", 
    category: "Catering" 
  }
];

export const galleryCategories = [
  { id: "all", name: "Todos" },
  { id: "espaco", name: "Espaço & Crianças felizes" },
  { id: "catering", name: "Catering" }
];

export const features = [
  {
    id: 1,
    title: "Espaço seguro e adaptado para crianças",
    description: "Instalações pensadas ao pormenor para a segurança dos mais pequenos, com áreas protegidas e supervisão constante",
    icon: "Shield"
  },
  {
    id: 2,
    title: "Ambiente privado para a sua festa",
    description: "Celebre em exclusivo! O espaço é totalmente privado durante a sua festa — sem partilhar com outros eventos",
    icon: "Lock"
  },
  {
    id: 3,
    title: "Diversão garantida com várias atividades",
    description: "Área de brincadeiras, jogos e animação que mantêm as crianças felizes e entretidas do início ao fim",
    icon: "PartyPopper"
  },
  {
    id: 4,
    title: "Sem stress para os pais — tratamos de tudo",
    description: "Relaxe e aproveite! Cuidamos da decoração, animação e limpeza. Você só precisa de curtir o momento especial",
    icon: "Heart"
  }
];

export const contactInfo = {
  phone: "+351935541254",
  whatsapp: "+351935541254",
  instagram: "espacogirafinha.silves",
  facebook: "https://www.facebook.com/p/Girafinha-decora%C3%A7%C3%A3o-61559630369569/",
  address: "Silves, Algarve, Portugal",
  whatsappMessage: "Olá! Gostaria de saber disponibilidade para uma festa no Espaço Girafinha."
};

export const testimonials = [
  {
    id: 1,
    text: "Foi uma excelente decisão! As crianças e os adultos divertiram-se sem preocupações, a comida estava ótima e a decoração estava um mimo. Espaço limpo e equipa muito profissional.",
    author: "Marta",
    location: "Lagoa",
    rating: 5
  },
  {
    id: 2,
    text: "Espaço fantástico! Decoração, catering e apoio durante a festa foram impecáveis. Muito fácil e tranquilo para os pais.",
    author: "Ana",
    location: "Portimão",
    rating: 5
  },
  {
    id: 3,
    text: "Não tenho nada a apontar! Desde a decoração ao atendimento, tudo foi excelente. As crianças adoraram e sentimos muito carinho em todos os detalhes.",
    author: "Amanda",
    location: "Tunes",
    rating: 5
  },
  {
    id: 4,
    text: "Um dia super feliz para o meu filho! A decoração, o espaço e todo o carinho fizeram a diferença. Recomendo a 100%.",
    author: "Jéssica",
    location: "Silves",
    rating: 5
  },
  {
    id: 5,
    text: "Adorámos tudo! As crianças divertiram-se imenso, ambiente excelente e equipa sempre disponível. Vamos voltar de certeza!",
    author: "Tânia",
    location: "Silves",
    rating: 5
  }
];

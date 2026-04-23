import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Shield, Lock, PartyPopper, Heart, Phone, Instagram, Facebook, MapPin, Check, MessageCircle, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { packages, galleryImages, features, contactInfo, testimonials, foodOptions, faqs } from '../data/mock';

const iconMap = {
  Shield: Shield,
  Lock: Lock,
  PartyPopper: PartyPopper,
  Heart: Heart
};

const Home = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: ''
  });
  
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [currentGalleryEspaco, setCurrentGalleryEspaco] = useState(0);
  const [currentGalleryDecoracao, setCurrentGalleryDecoracao] = useState(0);
  const [currentGalleryCatering, setCurrentGalleryCatering] = useState(0);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const whatsappMessage = `Olá! Sou ${formData.name}.\nTelefone: ${formData.phone}\nEmail: ${formData.email}\n\nMensagem: ${formData.message}`;
    const whatsappUrl = `https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const scrollToContact = () => {
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}`;
    window.open(whatsappUrl, '_blank');
  };

  const scrollCarousel = (direction, carouselId) => {
    const carousel = document.getElementById(carouselId);
    if (carousel) {
      const scrollAmount = carousel.offsetWidth * 0.8;
      carousel.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollGalleryToIndex = (carouselId, index, totalImages) => {
    const carousel = document.getElementById(carouselId);
    if (carousel) {
      const cardWidth = carousel.scrollWidth / totalImages;
      carousel.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
    }
  };

  // Auto-slide for testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Scroll to testimonial when index changes
  useEffect(() => {
    const carousel = document.getElementById('testimonials-carousel');
    if (carousel) {
      const cardWidth = carousel.scrollWidth / testimonials.length;
      carousel.scrollTo({
        left: cardWidth * currentTestimonial,
        behavior: 'smooth'
      });
    }
  }, [currentTestimonial]);

  // Show tooltip after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
      // Hide tooltip after 5 seconds
      setTimeout(() => setShowTooltip(false), 5000);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-yellow-50 to-green-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-sm z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Logotipo girafinha  (1).png" alt="Espaço Girafinha" className="h-12 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-teal-600">Espaço Girafinha</h1>
                <p className="text-xs text-gray-600">Silves, Algarve</p>
              </div>
            </div>
            <nav className="hidden md:flex gap-6">
              <a href="#sobre" className="text-gray-700 hover:text-teal-500 transition-colors">Sobre</a>
              <a href="#pacotes" className="text-gray-700 hover:text-teal-500 transition-colors">Pacotes</a>
              <a href="#galeria" className="text-gray-700 hover:text-teal-500 transition-colors">Galeria</a>
              <a href="#contacto" className="text-gray-700 hover:text-teal-500 transition-colors">Contacto</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
        
        {/* Imagem de fundo */}
        <img
          src="/hero-party.jpg"
          alt="Festa infantil no Espaço Girafinha"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Overlay escuro */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Conteúdo */}
        <div className="container mx-auto relative z-10 text-center max-w-4xl">
          
          {/* Desktop Title */}
          <h2 className="hidden md:block text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            🎉 A festa perfeita para o seu filho — sem stress para si
          </h2>

          {/* Mobile Title (Simplified) */}
          <h2 className="block md:hidden text-4xl font-bold text-white mb-4 leading-tight">
            🎉 A Festa Perfeita <br/>Sem Stress
          </h2>

          {/* Desktop Subtitle */}
          <p className="hidden md:block text-xl md:text-2xl text-white mb-4 font-semibold">
            Espaço privado em Silves com decoração, animação e catering incluído
          </p>

          {/* Mobile Subtitle (Simplified) */}
          <p className="block md:hidden text-lg text-white mb-3 font-semibold">
            Espaço privado em Silves
          </p>

          <p className="text-lg md:text-xl text-yellow-300 font-bold mb-8">
            ⚠️ Fins de semana esgotam rápido
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="w-auto bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl px-8 py-6 rounded-full font-bold shadow-xl"
              onClick={openWhatsApp}
            >
              💬 Pedir Orçamento
            </Button>

            <Button
              size="lg"
              className="w-auto bg-white text-teal-600 text-lg md:text-xl px-8 py-6 rounded-full font-bold shadow-xl hover:bg-gray-100"
              onClick={() => {
                const section = document.getElementById('pacotes');
                if (section) {
                  section.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              Ver Preços
            </Button>
          </div>
        </div>

        {/* Gradiente inferior */}

  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10"></div>

</section>

      {/* About Section */}
<section id="sobre" className="py-20 px-4 bg-white">
  <div className="container mx-auto max-w-5xl">
    
    <div className="text-center mb-12">
      <h3 className="text-4xl font-bold text-gray-900 mb-4">
        Sobre o Espaço Girafinha
      </h3>
      <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full"></div>
    </div>

    <div className="bg-gradient-to-br from-teal-50 to-yellow-50 rounded-3xl p-8 md:p-12 shadow-xl">
      
      <div className="prose prose-lg max-w-none text-gray-700">
        <p className="text-xl leading-relaxed mb-6 text-center font-semibold text-gray-800">
          Transformamos aniversários em memórias inesquecíveis! ✨
        </p>

        <p className="text-lg leading-relaxed mb-6">
          O <strong className="text-teal-600">Espaço Girafinha</strong> nasceu do sonho de criar o local perfeito para celebrar 
          momentos especiais com os mais pequenos. Localizado em <strong>Silves, Algarve</strong>, o nosso espaço oferece 
          um ambiente <strong>seguro, colorido e totalmente privado</strong>, onde as crianças podem brincar, 
          rir e criar memórias que vão guardar para sempre.
        </p>

        <p className="text-lg leading-relaxed mb-6">
          Sabemos que organizar uma festa infantil pode ser stressante. Por isso, criámos pacotes completos 
          onde cuidamos de <strong>todos os detalhes</strong> — desde a decoração personalizada até à animação 
          e lanche. Os pais podem finalmente relaxar e <strong>aproveitar o momento especial</strong> ao lado 
          dos seus filhos, sem preocupações.
        </p>

        <p className="text-lg leading-relaxed text-center">
          <strong className="text-teal-600 text-xl">
            Mais do que um espaço de festas, somos parceiros na criação de sorrisos! 😊
          </strong>
        </p>
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-xs md:text-sm font-semibold text-gray-700">Licença de Funcionamento</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl mb-2">🛡️</div>
          <p className="text-xs md:text-sm font-semibold text-gray-700">Seguro de Responsabilidade</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl mb-2">🧼</div>
          <p className="text-xs md:text-sm font-semibold text-gray-700">Higienizado Diariamente</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl mb-2">👨‍👩‍👧</div>
          <p className="text-xs md:text-sm font-semibold text-gray-700">Ambiente Familiar</p>
        </div>
      </div>

      {/* CTA Button */}
      <div className="text-center mt-8">
        <Button
          size="lg"
          onClick={openWhatsApp}
          className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-lg rounded-full font-semibold shadow-lg hover:shadow-xl transition-all">
          📸 Marcar Visita sem Compromisso
        </Button>
        <p className="text-sm text-gray-600 mt-3">Vem conhecer o espaço antes de reservar!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-10 text-center">

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-md">
          <p className="text-3xl md:text-4xl font-bold text-teal-600 mb-2">100+</p>
          <p className="text-gray-700 text-sm md:text-base font-semibold">Festas Realizadas</p>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-md">
          <p className="text-3xl md:text-4xl font-bold text-teal-600 mb-2">100%</p>
          <p className="text-gray-700 text-sm md:text-base font-semibold">Pais Satisfeitos</p>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-md">
          <p className="text-3xl md:text-4xl font-bold text-teal-600 mb-2">5★</p>
          <p className="text-gray-700 text-sm md:text-base font-semibold">Avaliação Google</p>
        </div>

      </div>

    </div> {/* fecha bg-gradient */}

  </div> {/* fecha container */}

</section>


      {/* Packages Section */}
      <section id="pacotes" className="py-20 px-4 bg-gradient-to-b from-yellow-50 to-teal-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Pacotes de Festas</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600 mb-2">Escolha o pacote perfeito para a festa do seu filho</p>
            <p className="text-lg text-teal-600 font-bold animate-pulse mb-4">
              ⚠️ Disponibilidade limitada — garanta já a sua data!
            </p>
            <p className="text-lg text-gray-700 font-semibold mb-2">
              👇 Escolha o pack ideal para a festa do seu filho
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {packages.map((pkg) => (
              <Card 
                key={pkg.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                  pkg.popular 
                    ? 'border-3 border-teal-500 shadow-xl bg-white' 
                    : 'border border-gray-200 bg-white'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-teal-500 text-white text-center py-2 text-sm font-bold">
                    ⭐ MAIS POPULAR
                  </div>
                )}
                
                {/* Promotion Badge */}
                {pkg.isPromotion && (
                  <div className={`${pkg.popular ? 'mt-10' : 'mt-0'} bg-gradient-to-r from-teal-500 to-teal-600 text-white text-center py-2 px-4 text-sm font-bold`}>
                    🎉 Promoção Especial de 1º Aniversário
                  </div>
                )}
                
                <CardHeader className={pkg.popular && pkg.isPromotion ? 'pt-4' : pkg.popular ? 'pt-12' : pkg.isPromotion ? 'pt-4' : 'pt-6'}>
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-3">
                    {pkg.name}
                  </CardTitle>
                  
                  {/* Pricing with Original + Discounted */}
                  <div className="mb-4">
                    {pkg.isPromotion && pkg.originalPrice && (
                      <div className="mb-2">
                        <span className="text-lg text-gray-400 line-through font-medium">
                          {pkg.originalPrice}
                        </span>
                      </div>
                    )}
                    <div className="text-4xl font-bold text-teal-600">
                      {pkg.price}
                    </div>
                    {pkg.isPromotion && (
                      <p className="text-xs text-teal-600 font-semibold mt-2">
                        ⏰ Aproveite esta oferta por tempo limitado
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-teal-50 rounded-lg p-3 mb-4">
                    {pkg.schedules.map((schedule, index) => (
                      <p key={index} className="text-sm font-semibold text-gray-700">
                        {schedule}
                      </p>
                    ))}
                  </div>
                  
                  {/* Flexible Booking Badge */}
                  <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                    <span className="text-green-700 font-bold text-sm">✅ Reserva Flexível</span>
                    <span className="text-green-600 text-xs">• Sinal de apenas 20%</span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="border-t border-gray-200 mb-4"></div>
                  
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3">
                      Inclui:
                    </p>
                    <ul className="space-y-2">
                      {pkg.includes.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="leading-tight">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {pkg.extras && pkg.extras.length > 0 && (
                    <div className="mb-4 bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">
                        Extras:
                      </p>
                      <ul className="space-y-1">
                        {pkg.extras.map((extra, index) => (
                          <li key={index} className="text-xs md:text-sm text-gray-700 font-semibold">
                            • {extra}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {pkg.notes && pkg.notes.length > 0 && (
                    <div className="mb-6 border-t border-gray-200 pt-4">
                      <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">
                        Notas:
                      </p>
                      <ul className="space-y-1.5">
                        {pkg.notes.map((note, index) => (
                          <li key={index} className="text-xs text-gray-600 leading-relaxed">
                            • {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <Button 
                    className={`w-full text-white rounded-full font-semibold py-6 ${
                      pkg.popular 
                        ? 'bg-teal-600 hover:bg-teal-700 shadow-lg' 
                        : 'bg-teal-500 hover:bg-teal-600'
                    }`}
                    onClick={openWhatsApp}
                  >
                    💬 Saber disponibilidade
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-sm text-gray-600">
              Todos os preços incluem IVA à taxa legal em vigor.
            </p>
          </div>
        </div>
      </section>

      {/* Food Options Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Opções de Lanche e Catering</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {foodOptions.map((option) => (
              <Card key={option.id} className="border-2 border-teal-100 hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl text-teal-600 mb-2">{option.name}</CardTitle>
                  {option.subtitle && (
                    <p className="text-sm font-semibold text-gray-700 bg-teal-50 rounded-lg px-3 py-2 inline-block">
                      {option.subtitle}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3">
                    Inclui:
                  </p>
                  <ul className="space-y-2">
                    {option.includes.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 rounded-full font-semibold"
              onClick={openWhatsApp}
            >
              💬 Pedir Informações sobre Lanche e Catering
            </Button>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="galeria" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Galeria de Momentos Felizes</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Fotos reais das festas realizadas no nosso espaço — momentos inesquecíveis!</p>
          </div>
          
          {/* Espaço & Crianças felizes */}
          <div className="mb-16">
            <h4 className="text-2xl font-bold text-gray-900 mb-6 px-4">Espaço & Crianças felizes</h4>
            <div className="relative group/carousel">
              {/* Left Arrow */}
              <button
                onClick={() => scrollCarousel('left', 'carousel-espaco')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6 text-teal-600" />
              </button>
              
              {/* Right Arrow */}
              <button
                onClick={() => scrollCarousel('right', 'carousel-espaco')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Próximo"
              >
                <ChevronRight className="w-6 h-6 text-teal-600" />
              </button>
              
              <div id="carousel-espaco" className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 md:gap-6 px-4 md:px-0 snap-x snap-mandatory">
                  {galleryImages
                    .filter((image) => image.category === "Espaço & Crianças felizes")
                    .map((image) => (
                      <div
                        key={image.id}
                        className="flex-none w-[85vw] sm:w-[45vw] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)] snap-center"
                      >
                        <div className="relative overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 aspect-square group cursor-pointer">
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <p className="text-white text-sm font-semibold">{image.alt}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* Dots Indicator - Mobile Only */}
              <div className="flex md:hidden justify-center gap-2 mt-4">
                {galleryImages
                  .filter((image) => image.category === "Espaço & Crianças felizes")
                  .map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => {
                        setCurrentGalleryEspaco(index);
                        scrollGalleryToIndex('carousel-espaco', index, 5);
                      }}
                      className={`transition-all duration-300 rounded-full ${
                        index === currentGalleryEspaco
                          ? 'w-6 h-2 bg-teal-600'
                          : 'w-2 h-2 bg-gray-300'
                      }`}
                      aria-label={`Imagem ${index + 1}`}
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* Decoração */}
          <div className="mb-16">
            <h4 className="text-2xl font-bold text-gray-900 mb-6 px-4">Decoração</h4>
            <div className="relative group/carousel">
              {/* Left Arrow */}
              <button
                onClick={() => scrollCarousel('left', 'carousel-decoracao')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6 text-teal-600" />
              </button>
              
              {/* Right Arrow */}
              <button
                onClick={() => scrollCarousel('right', 'carousel-decoracao')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Próximo"
              >
                <ChevronRight className="w-6 h-6 text-teal-600" />
              </button>
              
              <div id="carousel-decoracao" className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 md:gap-6 px-4 md:px-0 snap-x snap-mandatory">
                  {galleryImages
                    .filter((image) => image.category === "Decoração")
                    .map((image) => (
                      <div
                        key={image.id}
                        className="flex-none w-[85vw] sm:w-[45vw] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)] snap-center"
                      >
                        <div className="relative overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 aspect-square group cursor-pointer">
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <p className="text-white text-sm font-semibold">{image.alt}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* Dots Indicator - Mobile Only */}
              <div className="flex md:hidden justify-center gap-2 mt-4">
                {galleryImages
                  .filter((image) => image.category === "Decoração")
                  .map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => {
                        setCurrentGalleryDecoracao(index);
                        scrollGalleryToIndex('carousel-decoracao', index, 5);
                      }}
                      className={`transition-all duration-300 rounded-full ${
                        index === currentGalleryDecoracao
                          ? 'w-6 h-2 bg-teal-600'
                          : 'w-2 h-2 bg-gray-300'
                      }`}
                      aria-label={`Imagem ${index + 1}`}
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* Catering */}
          <div className="mb-12">
            <h4 className="text-2xl font-bold text-gray-900 mb-6 px-4">Catering</h4>
            <div className="relative group/carousel">
              {/* Left Arrow */}
              <button
                onClick={() => scrollCarousel('left', 'carousel-catering')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6 text-teal-600" />
              </button>
              
              {/* Right Arrow */}
              <button
                onClick={() => scrollCarousel('right', 'carousel-catering')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
                aria-label="Próximo"
              >
                <ChevronRight className="w-6 h-6 text-teal-600" />
              </button>
              
              <div id="carousel-catering" className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 md:gap-6 px-4 md:px-0 snap-x snap-mandatory">
                  {galleryImages
                    .filter((image) => image.category === "Catering")
                    .map((image) => (
                      <div
                        key={image.id}
                        className="flex-none w-[85vw] sm:w-[45vw] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)] snap-center"
                      >
                        <div className="relative overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 aspect-square group cursor-pointer">
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <p className="text-white text-sm font-semibold">{image.alt}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* Dots Indicator - Mobile Only */}
              <div className="flex md:hidden justify-center gap-2 mt-4">
                {galleryImages
                  .filter((image) => image.category === "Catering")
                  .map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => {
                        setCurrentGalleryCatering(index);
                        scrollGalleryToIndex('carousel-catering', index, 5);
                      }}
                      className={`transition-all duration-300 rounded-full ${
                        index === currentGalleryCatering
                          ? 'w-6 h-2 bg-teal-600'
                          : 'w-2 h-2 bg-gray-300'
                      }`}
                      aria-label={`Imagem ${index + 1}`}
                    />
                  ))}
              </div>
            </div>
          </div>
          
          <div className="text-center mt-16">
            <p className="text-lg text-gray-600 mb-4">
              Quer ver a sua festa aqui? 📸
            </p>
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 rounded-full font-semibold"
              onClick={openWhatsApp}
            >
              Reserve Já a Sua Data
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-green-50 to-yellow-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Porque Escolher o Espaço Girafinha?</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((feature) => {
              const IconComponent = iconMap[feature.icon];
              return (
                <Card key={feature.id} className="hover:shadow-xl transition-shadow duration-300 border-2 border-teal-100">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-7 w-7 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-gray-900 mb-3">{feature.title}</CardTitle>
                        <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>);

            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">O que dizem os pais</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Experiências reais de famílias que confiaram em nós</p>
          </div>
          
          {/* Testimonials Carousel */}
          <div className="relative group/testimonials">
            {/* Left Arrow */}
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/testimonials:opacity-100 transition-opacity duration-300"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-6 h-6 text-teal-600" />
            </button>
            
            {/* Right Arrow */}
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/testimonials:opacity-100 transition-opacity duration-300"
              aria-label="Próximo"
            >
              <ChevronRight className="w-6 h-6 text-teal-600" />
            </button>
            
            <div 
              id="testimonials-carousel"
              className="overflow-x-auto scrollbar-hide"
              onMouseEnter={() => {
                const interval = window.testimonialInterval;
                if (interval) clearInterval(interval);
              }}
            >
              <div className="flex gap-6 px-4 md:px-0">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={testimonial.id}
                    className="flex-none w-[90vw] sm:w-[70vw] md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
                  >
                    <Card className={`bg-white border-2 hover:shadow-2xl transition-all duration-500 h-full ${
                      index === currentTestimonial 
                        ? 'border-teal-300 shadow-xl scale-105' 
                        : 'border-gray-100 hover:border-teal-200'
                    }`}>
                      <CardHeader>
                        {/* Stars */}
                        <div className="flex gap-1 mb-4">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <svg
                              key={i}
                              className="w-5 h-5 fill-teal-500"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          ))}
                        </div>
                        
                        {/* Quote Icon */}
                        <Quote className="h-8 w-8 text-teal-200 mb-2" />
                      </CardHeader>
                      
                      <CardContent>
                        {/* Testimonial Text */}
                        <p className="text-gray-700 leading-relaxed mb-6 italic">
                          "{testimonial.text}"
                        </p>
                        
                        {/* Author */}
                        <div className="border-t border-gray-200 pt-4">
                          <p className="font-bold text-gray-900">{testimonial.author}</p>
                          <p className="text-sm text-gray-600">{testimonial.location}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentTestimonial
                      ? 'w-8 h-3 bg-teal-600'
                      : 'w-3 h-3 bg-gray-300 hover:bg-teal-400'
                  }`}
                  aria-label={`Ir para avaliação ${index + 1}`}
                />
              ))}
            </div>
          </div>
          
          {/* Google Reviews CTA */}
          <div className="text-center mt-12">
            <a
              href="https://share.google/WJZdIImo9oEzcB9ny"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-teal-50 hover:bg-teal-100 rounded-full px-6 py-3 border-2 border-teal-200 hover:border-teal-300 transition-all duration-300 hover:shadow-lg">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 fill-teal-500"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="text-gray-800 font-semibold">
                5.0 • 17 Avaliações no Google
              </span>
            </a>
            <p className="text-sm text-gray-600 mt-3">⭐ Lê mais avaliações no Google Reviews</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-yellow-50 to-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Perguntas Frequentes</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Esclarecemos as suas dúvidas</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <details className="group">
                  <summary className="flex justify-between items-center cursor-pointer p-6 hover:bg-teal-50 transition-colors">
                    <h4 className="font-bold text-lg text-gray-900">{faq.question}</h4>
                    <span className="text-teal-600 text-2xl group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <div className="px-6 pb-6 pt-2 text-gray-700 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-10">
            <p className="text-gray-600 mb-4">Ainda tens dúvidas?</p>
            <Button
              size="lg"
              onClick={openWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-full font-semibold">
              💬 Fala Connosco pelo WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Instagram Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-white to-teal-50">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="mb-8">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Segue-nos no Instagram</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Vê as festas mais recentes e inspira-te!</p>
          </div>
          
          <a
            href={`https://instagram.com/${contactInfo.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-block">
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-1 rounded-3xl hover:shadow-2xl transition-all duration-300">
              <div className="bg-white rounded-3xl p-8 group-hover:scale-105 transition-transform duration-300">
                <Instagram className="h-16 w-16 text-gray-800 mx-auto mb-4" />
                <p className="text-2xl font-bold text-gray-900 mb-2">@{contactInfo.instagram}</p>
                <p className="text-gray-600 mb-4">Festas • Decoração • Momentos Felizes</p>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold">
                  <Instagram className="h-5 w-5" />
                  Seguir no Instagram
                </div>
              </div>
            </div>
          </a>
          
          <p className="text-gray-600 mt-6">📸 Vê vídeos e fotos das nossas festas</p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Reserve a Festa dos Sonhos</h3>
            <div className="w-24 h-1 bg-teal-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600 mb-2">Pronto para criar memórias inesquecíveis?</p>
            <p className="text-lg text-teal-600 font-bold animate-pulse mb-2">
              ⚠️ Vagas limitadas — garanta já a sua data preferida!
            </p>
            <p className="text-base text-green-600 font-semibold">
              ⏱️ Resposta rápida em poucas horas
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h4 className="text-2xl font-bold text-gray-900 mb-6">Fale Connosco</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <Phone className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <a href={`tel:${contactInfo.phone}`} className="text-gray-700 hover:text-teal-600 font-semibold">
                      {contactInfo.phone}
                    </a>
                    <p className="text-xs text-gray-500">(custo de chamada para rede móvel nacional)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <Instagram className="h-6 w-6 text-teal-600" />
                  </div>
                  <a
                    href={`https://instagram.com/${contactInfo.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-teal-600 font-semibold">

                    @{contactInfo.instagram}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <Facebook className="h-6 w-6 text-teal-600" />
                  </div>
                  <a
                    href={contactInfo.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-teal-600 font-semibold">

                    Girafinha Decoração
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-teal-600" />
                  </div>
                  <span className="text-gray-700 font-semibold">{contactInfo.address}</span>
                </div>
              </div>
              
              <div className="mt-8 p-6 bg-teal-50 rounded-xl border-2 border-teal-200">
                <p className="text-gray-800 font-semibold mb-2">💡 Resposta rápida garantida!</p>
                <p className="text-gray-600 text-sm">
                  Respondemos a todas as mensagens em menos de 2 horas durante o horário comercial
                </p>
              </div>
            </div>
            
            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    name="name"
                    placeholder="Nome completo"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="border-teal-200 focus:border-teal-600 h-12" />

                </div>
                <div>
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="Telefone / WhatsApp"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="border-teal-200 focus:border-teal-600 h-12" />

                </div>
                <div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="border-teal-200 focus:border-teal-600 h-12" />

                </div>
                <div>
                  <Textarea
                    name="message"
                    placeholder="Conte-nos sobre a festa que imagina (data pretendida, número de crianças, tema...)"
                    rows={5}
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    className="border-teal-200 focus:border-teal-600" />

                </div>
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-7 rounded-full text-lg font-bold shadow-xl hover:shadow-2xl">

                  💬 Pedir Orçamento por WhatsApp
                </Button>
                <p className="text-xs text-center text-gray-500">
                  Ao enviar, será redirecionado para o WhatsApp com a sua mensagem pronta
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <img src="/Logotipo girafinha  (1).png" alt="Espaço Girafinha" className="h-16 w-auto mx-auto mb-4" />
          <h4 className="text-2xl font-bold mb-2">Espaço Girafinha</h4>
          <p className="text-gray-400 mb-6">Festas Infantis em Silves, Algarve</p>
          <div className="flex justify-center gap-6 mb-6">
            <a
              href={`https://instagram.com/${contactInfo.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-400 transition-colors">

              <Instagram className="h-6 w-6" />
            </a>
            <a
              href={contactInfo.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-400 transition-colors">

              <Facebook className="h-6 w-6" />
            </a>
            <a
              href={`https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-400 transition-colors">

              <MessageCircle className="h-6 w-6" />
            </a>
          </div>
          
          {/* Legal Links */}
          <div className="flex flex-wrap justify-center gap-4 mb-4 text-sm">
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="text-gray-400 hover:text-white transition-colors underline">
              Política de Privacidade
            </button>
            <button
              onClick={() => setShowTermsModal(true)}
              className="text-gray-400 hover:text-white transition-colors underline">
              Termos e Condições
            </button>
            <a
              href="https://www.livroreclamacoes.pt/Inicio/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors underline">
              Livro de Reclamações
            </a>
          </div>
          
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Espaço Girafinha. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-lg max-w-3xl max-h-[80vh] overflow-y-auto p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Política de Privacidade</h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-gray-500 hover:text-gray-700">
                <span className="text-3xl">×</span>
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString('pt-PT')}</p>
              
              <h3 className="font-bold text-lg mt-6">1. Informações que Recolhemos</h3>
              <p>O Espaço Girafinha recolhe informações pessoais quando você:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Preenche o formulário de contacto (nome, telefone, email, mensagem)</li>
                <li>Entra em contacto via WhatsApp ou telefone</li>
                <li>Visita o nosso website (através de cookies de navegação)</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">2. Como Utilizamos os Seus Dados</h3>
              <p>Os seus dados pessoais são utilizados para:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Responder aos seus pedidos de informação e orçamentos</li>
                <li>Processar reservas de festas e eventos</li>
                <li>Comunicar sobre os nossos serviços e promoções (com o seu consentimento)</li>
                <li>Melhorar a experiência do website</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">3. Proteção de Dados</h3>
              <p>O Espaço Girafinha compromete-se a proteger os seus dados pessoais. Implementamos medidas de segurança técnicas e organizacionais adequadas para proteger as suas informações contra acesso não autorizado, perda ou destruição.</p>
              
              <h3 className="font-bold text-lg mt-6">4. Os Seus Direitos (RGPD)</h3>
              <p>De acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD), tem o direito de:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Aceder aos seus dados pessoais</li>
                <li>Retificar dados incorretos</li>
                <li>Eliminar os seus dados ("direito ao esquecimento")</li>
                <li>Limitar o processamento dos seus dados</li>
                <li>Portabilidade dos dados</li>
                <li>Opor-se ao processamento</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">5. Partilha de Dados</h3>
              <p>Não vendemos, alugamos ou partilhamos os seus dados pessoais com terceiros para fins de marketing. Os seus dados podem ser partilhados apenas com:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Fornecedores de serviços essenciais (ex: hosting)</li>
                <li>Autoridades legais, quando legalmente obrigatório</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">6. Cookies</h3>
              <p>O nosso website utiliza cookies essenciais para o funcionamento do site. Não utilizamos cookies de tracking ou publicidade.</p>
              
              <h3 className="font-bold text-lg mt-6">7. Contacto</h3>
              <p>Para exercer os seus direitos ou esclarecer dúvidas sobre privacidade:</p>
              <p className="font-semibold">WhatsApp/Telefone: {contactInfo.phone}</p>
              <p className="font-semibold">Instagram: @{contactInfo.instagram}</p>
              
              <div className="mt-8 pt-6 border-t">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-lg max-w-3xl max-h-[80vh] overflow-y-auto p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Termos e Condições</h2>
              <button onClick={() => setShowTermsModal(false)} className="text-gray-500 hover:text-gray-700">
                <span className="text-3xl">×</span>
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString('pt-PT')}</p>
              
              <h3 className="font-bold text-lg mt-6">1. Serviços Prestados</h3>
              <p>O Espaço Girafinha oferece serviços de aluguer de espaço para festas infantis, incluindo decoração, animação, catering e outras atividades conforme descrito nos pacotes disponíveis.</p>
              
              <h3 className="font-bold text-lg mt-6">2. Reservas e Pagamento</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>A reserva é confirmada mediante pagamento de <strong>20% do valor total</strong> do pacote escolhido</li>
                <li>O pagamento restante (80%) deve ser efetuado <strong>no dia do evento</strong></li>
                <li>O sinal de reserva <strong>não é reembolsável</strong> em caso de cancelamento</li>
                <li>Recomendamos reservas com pelo menos 5 semanas de antecedência</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">3. Cancelamentos e Alterações</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>O depósito de reserva (20%) não é reembolsável</li>
                <li>Alterações de data estão sujeitas a disponibilidade</li>
                <li>Pedidos de alteração devem ser comunicados com antecedência mínima de 15 dias</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">4. Capacidade e Horários</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Capacidade máxima: 50 pessoas (adultos + crianças)</li>
                <li>Horários disponíveis: Manhã (10h-13h) / Tarde (16h-19h)</li>
                <li>Horas extra: 75€ por hora adicional</li>
                <li>Tolerância de 15 minutos no final do horário</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">5. Decoração e Personalização</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>É permitido trazer decoração própria</li>
                <li>Fixação de decoração deve ser feita sem danificar as instalações</li>
                <li>Proibido uso de confetti, glitter ou materiais de difícil limpeza</li>
                <li>Decoração fornecida pelo Espaço Girafinha (em pacotes com decoração incluída) será montada e desmontada pela nossa equipa</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">6. Catering e Alimentos</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>É permitido trazer comida e bolo próprios</li>
                <li>Catering fornecido pelo Espaço Girafinha é preparado com ingredientes de qualidade</li>
                <li>Alergias e restrições alimentares devem ser comunicadas com antecedência</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">7. Responsabilidade e Segurança</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>O Espaço Girafinha não se responsabiliza por objetos pessoais perdidos ou danificados</li>
                <li>Os pais/responsáveis devem supervisionar as crianças durante o evento</li>
                <li>Danos às instalações ou equipamentos serão cobrados aos responsáveis</li>
                <li>O espaço dispõe de seguro de responsabilidade civil</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">8. Regras do Espaço</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Proibido fumar em todo o espaço</li>
                <li>Proibido consumo de bebidas alcoólicas em excesso</li>
                <li>Respeitar os horários acordados</li>
                <li>Deixar o espaço nas condições em que foi encontrado</li>
              </ul>
              
              <h3 className="font-bold text-lg mt-6">9. Contacto</h3>
              <p>Para dúvidas ou esclarecimentos:</p>
              <p className="font-semibold">WhatsApp/Telefone: {contactInfo.phone}</p>
              <p className="font-semibold">Instagram: @{contactInfo.instagram}</p>
              
              <div className="mt-8 pt-6 border-t">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl whitespace-nowrap animate-bounce">
            💬 Dúvidas? Fala connosco!
            <div className="absolute bottom-0 right-8 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
          </div>
        )}
        
        <button
          onClick={openWhatsApp}
          className="bg-green-600 hover:bg-green-700 text-white p-5 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 animate-pulse"
          aria-label="Contactar via WhatsApp">
          <MessageCircle className="h-7 w-7" />
        </button>
      </div>
    </div>);

};

export default Home;
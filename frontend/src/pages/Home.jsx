import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Shield, Lock, PartyPopper, Heart, Phone, Instagram, Facebook, MapPin, Check, MessageCircle, Quote } from 'lucide-react';
import { packages, galleryImages, galleryCategories, features, contactInfo, testimonials, foodOptions } from '../data/mock';

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
  
  const [activeCategory, setActiveCategory] = useState('all');

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
    const whatsappUrl = `https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(contactInfo.whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-yellow-50 to-green-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-sm z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Logotipo girafinha  (1).png" alt="Espaço Girafinha" className="h-12 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-orange-600">Espaço Girafinha</h1>
                <p className="text-xs text-gray-600">Silves, Algarve</p>
              </div>
            </div>
            <nav className="hidden md:flex gap-6">
              <a href="#sobre" className="text-gray-700 hover:text-orange-500 transition-colors">Sobre</a>
              <a href="#pacotes" className="text-gray-700 hover:text-orange-500 transition-colors">Pacotes</a>
              <a href="#galeria" className="text-gray-700 hover:text-orange-500 transition-colors">Galeria</a>
              <a href="#contacto" className="text-gray-700 hover:text-orange-500 transition-colors">Contacto</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
        {/* Hero Image Element */}
        <img
          src="/hero-party.jpg"
          alt="Festa infantil no Espaço Girafinha"
          className="absolute inset-0 w-full h-full object-cover object-center" />

        
        {/* Dark Overlay for Text Readability */}
        <div className="absolute inset-0 bg-black/30"></div>
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-2xl">
              Festas infantis inesquecíveis em Silves{' '}
              <span className="inline-block animate-bounce">🎉</span>
            </h2>
            <p className="text-xl md:text-2xl text-white mb-4 font-semibold drop-shadow-lg">
              Diversão garantida para crianças e tranquilidade para os pais{' '}
              <span className="inline-block">🦒</span>
            </p>
            <p className="text-lg md:text-xl text-yellow-300 font-bold mb-8 animate-pulse drop-shadow-lg bg-black/40 inline-block px-6 py-2 rounded-full">
              ⚠️ Fins de semana esgotam rapidamente — reserve com antecedência
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 text-white text-lg md:text-xl px-10 py-7 rounded-full shadow-2xl hover:shadow-3xl transition-all font-bold"
                onClick={openWhatsApp}>

                💬 Ver disponibilidade
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10"></div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Sobre o Espaço Girafinha</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full"></div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-3xl p-8 md:p-12 shadow-xl">
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="text-xl leading-relaxed mb-6 text-center font-semibold text-gray-800">
                Transformamos aniversários em memórias inesquecíveis! ✨
              </p>
              <p className="text-lg leading-relaxed mb-6">
                O <strong className="text-orange-600">Espaço Girafinha</strong> nasceu do sonho de criar o local perfeito para celebrar 
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
                <strong className="text-orange-600 text-xl">
                  Mais do que um espaço de festas, somos parceiros na criação de sorrisos! 😊
                </strong>
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mt-10 text-center">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <p className="text-4xl font-bold text-orange-600 mb-2">100+</p>
                <p className="text-gray-700 font-semibold">Festas Realizadas</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <p className="text-4xl font-bold text-orange-600 mb-2">100%</p>
                <p className="text-gray-700 font-semibold">Pais Satisfeitos</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <p className="text-4xl font-bold text-orange-600 mb-2">5★</p>
                <p className="text-gray-700 font-semibold">Avaliação Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="pacotes" className="py-20 px-4 bg-gradient-to-b from-yellow-50 to-orange-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Pacotes de Festas</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600 mb-2">Escolha o pacote perfeito para a festa do seu filho</p>
            <p className="text-lg text-orange-600 font-bold animate-pulse mb-4">
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
                    ? 'border-3 border-orange-500 shadow-xl bg-white' 
                    : 'border border-gray-200 bg-white'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 text-sm font-bold">
                    ⭐ MAIS POPULAR
                  </div>
                )}
                
                <CardHeader className={pkg.popular ? 'pt-12' : 'pt-6'}>
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-3">
                    {pkg.name}
                  </CardTitle>
                  
                  <div className="mb-4">
                    <div className="text-4xl font-bold text-orange-600">
                      {pkg.price}
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-3 mb-4">
                    {pkg.schedules.map((schedule, index) => (
                      <p key={index} className="text-sm font-semibold text-gray-700">
                        {schedule}
                      </p>
                    ))}
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
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
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
                          <li key={index} className="text-sm text-gray-700 font-semibold">
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
                        ? 'bg-orange-600 hover:bg-orange-700 shadow-lg' 
                        : 'bg-orange-500 hover:bg-orange-600'
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
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {foodOptions.map((option) => (
              <Card key={option.id} className="border-2 border-orange-100 hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl text-orange-600 mb-2">{option.name}</CardTitle>
                  {option.subtitle && (
                    <p className="text-sm font-semibold text-gray-700 bg-orange-50 rounded-lg px-3 py-2 inline-block">
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
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-6 rounded-full font-semibold"
              onClick={openWhatsApp}
            >
              💬 Pedir Informações sobre Lanche e Catering
            </Button>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="galeria" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Galeria de Momentos Felizes</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600 mb-8">Fotos reais das festas realizadas no nosso espaço — momentos inesquecíveis!</p>
            
            {/* Category Filters */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {galleryCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                    activeCategory === category.id
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'bg-white text-orange-600 border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {galleryImages
              .filter((image) => activeCategory === 'all' || image.category === galleryCategories.find(cat => cat.id === activeCategory)?.name)
              .map((image) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 aspect-square group cursor-pointer"
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-sm font-semibold">{image.alt}</p>
                  </div>
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 bg-orange-600 text-white text-xs font-semibold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {image.category}
                  </div>
                </div>
              ))}
          </div>
          
          {/* Show message if no images in category */}
          {galleryImages.filter((image) => activeCategory === 'all' || image.category === galleryCategories.find(cat => cat.id === activeCategory)?.name).length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                Nenhuma imagem encontrada nesta categoria. Em breve adicionaremos mais fotos!
              </p>
            </div>
          )}
          
          <div className="text-center mt-12">
            <p className="text-lg text-gray-600 mb-4">
              Quer ver a sua festa aqui? 📸
            </p>
            <Button
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-6 rounded-full font-semibold"
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
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((feature) => {
              const IconComponent = iconMap[feature.icon];
              return (
                <Card key={feature.id} className="hover:shadow-xl transition-shadow duration-300 border-2 border-orange-100">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-7 w-7 text-orange-600" />
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
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">O que dizem os pais</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Experiências reais de famílias que confiaram em nós</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {testimonials.map((testimonial) =>
            <Card key={testimonial.id} className="bg-white border-2 border-gray-100 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) =>
                  <svg
                    key={i}
                    className="w-5 h-5 fill-orange-500"
                    viewBox="0 0 20 20">

                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                  )}
                  </div>
                  
                  {/* Quote Icon */}
                  <Quote className="h-8 w-8 text-orange-200 mb-2" />
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
            )}
          </div>
          
          {/* Google Reviews CTA */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-3 bg-orange-50 rounded-full px-6 py-3 border-2 border-orange-200">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) =>
                <svg
                  key={i}
                  className="w-5 h-5 fill-orange-500"
                  viewBox="0 0 20 20">

                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                )}
              </div>
              <span className="text-gray-800 font-semibold">
                5.0 no Google Reviews
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Reserve a Festa dos Sonhos</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600 mb-2">Pronto para criar memórias inesquecíveis?</p>
            <p className="text-lg text-orange-600 font-bold animate-pulse mb-2">
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
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Phone className="h-6 w-6 text-orange-600" />
                  </div>
                  <a href={`tel:${contactInfo.phone}`} className="text-gray-700 hover:text-orange-600 font-semibold">
                    {contactInfo.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Instagram className="h-6 w-6 text-orange-600" />
                  </div>
                  <a
                    href={`https://instagram.com/${contactInfo.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-orange-600 font-semibold">

                    @{contactInfo.instagram}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Facebook className="h-6 w-6 text-orange-600" />
                  </div>
                  <a
                    href={contactInfo.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-orange-600 font-semibold">

                    Girafinha Decoração
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-gray-700 font-semibold">{contactInfo.address}</span>
                </div>
              </div>
              
              <div className="mt-8 p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
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
                    className="border-orange-200 focus:border-orange-600 h-12" />

                </div>
                <div>
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="Telefone / WhatsApp"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-600 h-12" />

                </div>
                <div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-600 h-12" />

                </div>
                <div>
                  <Textarea
                    name="message"
                    placeholder="Conte-nos sobre a festa que imagina (data pretendida, número de crianças, tema...)"
                    rows={5}
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-600" />

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
              className="hover:text-orange-400 transition-colors">

              <Instagram className="h-6 w-6" />
            </a>
            <a
              href={contactInfo.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors">

              <Facebook className="h-6 w-6" />
            </a>
            <a
              href={`https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors">

              <MessageCircle className="h-6 w-6" />
            </a>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Espaço Girafinha. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <button
        onClick={openWhatsApp}
        className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white p-5 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 z-50 animate-pulse"
        aria-label="Contactar via WhatsApp">

        <MessageCircle className="h-7 w-7" />
      </button>
    </div>);

};

export default Home;
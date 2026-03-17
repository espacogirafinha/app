import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Shield, Lock, PartyPopper, Heart, Phone, Instagram, Facebook, MapPin, Check, MessageCircle } from 'lucide-react';
import { packages, galleryImages, features, contactInfo } from '../data/mock';

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
      <section className="relative pt-24 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-orange-100 to-green-100 opacity-60"></div>
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Festas Infantis em Silves{' '}
              <span className="inline-block animate-bounce">🎉</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 font-medium">
              O espaço perfeito para celebrar aniversários com diversão garantida
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
                onClick={scrollToContact}
              >
                Pedir Orçamento
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
                onClick={openWhatsApp}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Contactar
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-yellow-300 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-orange-300 rounded-full opacity-20 animate-pulse delay-100"></div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Sobre o Espaço Girafinha</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full"></div>
          </div>
          <div className="prose prose-lg max-w-none text-gray-700 text-center">
            <p className="text-lg leading-relaxed mb-6">
              O <strong>Espaço Girafinha</strong> é o local ideal para celebrar o aniversário do seu filho em Silves, Algarve. 
              Oferecemos um ambiente seguro, colorido e totalmente privado, onde as crianças podem brincar e divertir-se à vontade.
            </p>
            <p className="text-lg leading-relaxed mb-6">
              Com decorações personalizadas, área de brincadeiras e pacotes completos, cuidamos de todos os detalhes 
              para que os pais possam relaxar e aproveitar o momento especial junto com os seus filhos.
            </p>
            <p className="text-lg leading-relaxed">
              Venha conhecer o nosso espaço e descubra porque somos a escolha favorita das famílias do Algarve 
              para festas infantis inesquecíveis!
            </p>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="pacotes" className="py-20 px-4 bg-gradient-to-b from-yellow-50 to-orange-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Pacotes de Festas</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Escolha o pacote perfeito para a festa do seu filho</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {packages.map((pkg) => (
              <Card 
                key={pkg.id} 
                className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-orange-200 relative"
              >
                {pkg.popular && (
                  <Badge className="absolute top-4 right-4 bg-orange-500 text-white z-10">
                    Mais Popular
                  </Badge>
                )}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-yellow-100 to-orange-100">
                  <img
                    src={pkg.image}
                    alt={pkg.name}
                    className="w-full h-full object-contain p-4"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl text-orange-600">{pkg.name}</CardTitle>
                  <CardDescription className="text-base font-semibold text-gray-700">
                    {pkg.children}
                  </CardDescription>
                  <p className="text-sm text-gray-600 mt-2">{pkg.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pkg.included.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full"
                    onClick={openWhatsApp}
                  >
                    Pedir Informações
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="galeria" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Galeria de Momentos</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Veja algumas das festas realizadas no nosso espaço</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {galleryImages.map((image) => (
              <div
                key={image.id}
                className="relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 aspect-square group"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-green-50 to-yellow-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Porque Escolher-nos?</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature) => {
              const IconComponent = iconMap[feature.icon];
              return (
                <Card key={feature.id} className="text-center hover:shadow-xl transition-shadow duration-300 border-2 border-orange-100">
                  <CardHeader>
                    <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                      <IconComponent className="h-8 w-8 text-orange-500" />
                    </div>
                    <CardTitle className="text-xl text-gray-900">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Entre em Contacto</h3>
            <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-4"></div>
            <p className="text-xl text-gray-600">Pronto para reservar a festa perfeita?</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h4 className="text-2xl font-bold text-gray-900 mb-6">Informações</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Phone className="h-5 w-5 text-orange-500" />
                  </div>
                  <a href={`tel:${contactInfo.phone}`} className="text-gray-700 hover:text-orange-500">
                    {contactInfo.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Instagram className="h-5 w-5 text-orange-500" />
                  </div>
                  <a 
                    href={`https://instagram.com/${contactInfo.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-orange-500"
                  >
                    @{contactInfo.instagram}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Facebook className="h-5 w-5 text-orange-500" />
                  </div>
                  <a 
                    href={contactInfo.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-orange-500"
                  >
                    Girafinha Decoração
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="text-gray-700">{contactInfo.address}</span>
                </div>
              </div>
            </div>
            
            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    name="name"
                    placeholder="Nome"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-500"
                  />
                </div>
                <div>
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="Telefone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-500"
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-500"
                  />
                </div>
                <div>
                  <Textarea
                    name="message"
                    placeholder="Mensagem"
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    className="border-orange-200 focus:border-orange-500"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-6 rounded-full text-lg"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Enviar via WhatsApp
                </Button>
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
              className="hover:text-orange-400 transition-colors"
            >
              <Instagram className="h-6 w-6" />
            </a>
            <a
              href={contactInfo.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors"
            >
              <Facebook className="h-6 w-6" />
            </a>
            <a
              href={`https://wa.me/${contactInfo.whatsapp.replace(/\+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors"
            >
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
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 z-50"
        aria-label="Contactar via WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
};

export default Home;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Map as MapIcon, 
  User, 
  Plus, 
  MessageCircle, 
  Heart, 
  Navigation,
  ArrowLeft,
  Send,
  Camera,
  MapPin,
  Check,
  X,
  LogIn,
  Locate,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  Filter,
  Save,
  Trash2,
  Tag,
  AlertTriangle,
  Search,
  Eye,
  Layers,
  Users,
  Zap,
  Moon,
  Sun,
  Bell,
  Settings,
  LogOut
} from 'lucide-react';
import { generateNearbyEncounters, generateInitialMessage } from './services/geminiService';
import { Encounter, UserProfile, EncounterStatus, Chat, Location, ChatMessage, AVAILABLE_TAGS, EncounterTag } from './types';
import { getDistanceInMeters, MATCH_RADIUS } from './utils/geo';
import { EncounterCard } from './components/EncounterCard';
import { supabase } from './services/supabaseClient';

// --- Assets & Icons ---
const createIcon = (color: string) => L.divIcon({
  className: 'custom-icon',
  html: `<svg width="40" height="40" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.4));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Colors defined by user request (Updated to Rose-600)
const ICON_COLORS = {
  MINE: '#e11d48',       // Rose-600
  POSSIBLE: '#6b7280',   // Gray
  LIKED_ME: '#06b6d4',   // Celeste (Cyan-500)
  MATCH: '#22c55e'       // Green
};

const myIcon = createIcon(ICON_COLORS.MINE);
const possibleIcon = createIcon(ICON_COLORS.POSSIBLE);
const likedMeIcon = createIcon(ICON_COLORS.LIKED_ME);
const matchIcon = createIcon(ICON_COLORS.MATCH);

const createClusterIcon = (count: number) => L.divIcon({
  html: `<span>${count}</span>`,
  className: 'cluster-marker',
  iconSize: [40, 40]
});

// --- Components ---

// Component to handle map events internally (fixes context error)
const MapEvents: React.FC<{ onZoom: (zoom: number) => void; onMoveEnd: () => void }> = ({ onZoom, onMoveEnd }) => {
  const map = useMap();
  useEffect(() => {
    const zoomHandler = () => onZoom(map.getZoom());
    const moveHandler = () => onMoveEnd();
    
    map.on('zoomend', zoomHandler);
    map.on('moveend', moveHandler);
    
    return () => {
      map.off('zoomend', zoomHandler);
      map.off('moveend', moveHandler);
    };
  }, [map, onZoom, onMoveEnd]);
  return null;
};

// Map Controller for specific updates if needed
const MapController: React.FC<{ center: Location | null }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
};

// Match Overlay Animation Component
const MatchOverlay: React.FC<{ 
  userImage: string; 
  partnerImage: string; 
  partnerName: string;
  onClose: () => void;
  onChat: () => void;
}> = ({ userImage, partnerImage, partnerName, onClose, onChat }) => {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 {/* Confetti simulation with CSS dots */}
                 {[...Array(20)].map((_, i) => (
                     <div key={i} className="absolute w-2 h-2 rounded-full bg-yellow-400 animate-bounce" 
                          style={{
                              top: `${Math.random() * 100}%`,
                              left: `${Math.random() * 100}%`,
                              animationDelay: `${Math.random()}s`,
                              animationDuration: '2s'
                          }}
                     />
                 ))}
            </div>
            
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 italic mb-8 transform -rotate-6 animate-in zoom-in duration-700">
                It's a Match!
            </h1>

            <div className="flex items-center gap-8 mb-12 relative">
                 <img 
                    src={userImage} 
                    className="w-32 h-32 rounded-full border-4 border-white shadow-2xl transform rotate-12 animate-in slide-in-from-left duration-700" 
                    alt="Me"
                 />
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-lg z-10 animate-in zoom-in delay-500 duration-300">
                     <Heart className="fill-rose-500 text-rose-500 w-8 h-8" />
                 </div>
                 <img 
                    src={partnerImage} 
                    className="w-32 h-32 rounded-full border-4 border-white shadow-2xl transform -rotate-12 animate-in slide-in-from-right duration-700" 
                    alt="Partner"
                 />
            </div>

            <p className="text-white text-lg font-medium mb-8 text-center max-w-xs">
                Has conectado con <span className="font-bold text-rose-300">{partnerName}</span>.
            </p>

            <div className="flex flex-col gap-4 w-full max-w-xs px-6">
                <button 
                  onClick={onChat}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold py-4 rounded-full shadow-xl text-lg hover:scale-105 transition-transform"
                >
                    Enviar Mensaje
                </button>
                <button 
                  onClick={onClose}
                  className="w-full bg-white/10 text-white font-bold py-3 rounded-full hover:bg-white/20 transition-colors"
                >
                    Seguir Explorando
                </button>
            </div>
        </div>
    );
};

// Image Gallery Component
const ImageGallery: React.FC<{ images: string[]; onClose: () => void }> = ({ images, onClose }) => {
    const [idx, setIdx] = useState(0);

    return (
        <div className="fixed inset-0 z-[1100] bg-black flex flex-col animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-4 right-4 text-white z-50 p-2 bg-black/20 rounded-full">
                <X size={24} />
            </button>
            
            <div className="flex-1 flex items-center justify-center relative">
                 <img 
                   src={images[idx]} 
                   className="max-w-full max-h-full object-contain"
                   alt="Full screen"
                 />
                 
                 {images.length > 1 && (
                     <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1)); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-white p-2"
                        >
                            <ChevronRight className="rotate-180" size={40} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0)); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2"
                        >
                            <ChevronRight size={40} />
                        </button>
                     </>
                 )}
            </div>
            
            <div className="h-20 flex items-center justify-center gap-2 overflow-x-auto p-2">
                {images.map((img, i) => (
                    <img 
                       key={i} 
                       src={img} 
                       onClick={() => setIdx(i)}
                       className={`h-14 w-14 object-cover rounded-lg cursor-pointer transition-all ${i === idx ? 'border-2 border-rose-500 opacity-100' : 'opacity-50'}`}
                    />
                ))}
            </div>
        </div>
    );
}

// --- Main App ---

export default function App() {
  // --- State ---
  const [loginStep, setLoginStep] = useState<'landing' | 'register' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'map' | 'explore' | 'matches' | 'profile'>('map');
  const [currentView, setCurrentView] = useState<'main' | 'create' | 'details' | 'chat'>('main');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  // Data State
  const [location, setLocation] = useState<Location | null>(null); // Current User GPS
  const [mapCenter, setMapCenter] = useState<Location | null>(null); // Map Center (Crosshair)

  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: 'me',
    name: '',
    age: 0,
    gender: 'male',
    bio: 'Me encanta el café y React. Buscando coincidencias en la ciudad.',
    quickMessage: 'Me llamaste la atención, me pareciste linda e interesante',
    images: ['https://picsum.photos/id/1012/400/600', 'https://picsum.photos/id/1013/400/600'],
    isCurrentUser: true,
  });
  
  // Registration State
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'male' | 'female' | 'other'>('male');

  // App Data
  const [myEncounters, setMyEncounters] = useState<Encounter[]>([]);
  const [nearbyEncounters, setNearbyEncounters] = useState<Encounter[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  
  // Selection State
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [mapZoom, setMapZoom] = useState(16);

  // Form State - Create
  const [newEncounterTitle, setNewEncounterTitle] = useState('');
  const [newEncounterDesc, setNewEncounterDesc] = useState('');
  const [newEncounterImage, setNewEncounterImage] = useState<string | undefined>(undefined);
  const [newEncounterTags, setNewEncounterTags] = useState<EncounterTag[]>([]);

  // Form State - Edit Profile
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileBio, setEditProfileBio] = useState('');
  const [editProfileAge, setEditProfileAge] = useState('');
  const [editQuickMessage, setEditQuickMessage] = useState('');

  // Explore Filter State
  const [exploreMode, setExploreMode] = useState<'grouped' | 'list' | 'drilldown'>('grouped');
  const [exploreSelectedMyId, setExploreSelectedMyId] = useState<string | null>(null);
  const [filterTags, setFilterTags] = useState<EncounterTag[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  // Map Filters & Search
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapFilters, setMapFilters] = useState({
    mine: true,
    possible: true,
    likedMe: true,
    match: true
  });

  // UI State
  const [isTyping, setIsTyping] = useState(false);
  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false);
  const [showMatchOverlay, setShowMatchOverlay] = useState<{ visible: boolean, partner: UserProfile | null }>({ visible: false, partner: null });
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  
  // Notification System
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- Effects ---

  // 1. Get Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(loc);
          setMapCenter(loc); // Initial center
          
          // 2. Fetch mock data
          generateNearbyEncounters(loc.lat, loc.lng).then(encounters => {
             // Simulate one encounter being "Liked by them"
             if(encounters.length > 0) {
                 encounters[0].status = EncounterStatus.LIKED_BY_THEM;
             }
             setNearbyEncounters(encounters);
             setLoading(false);
          });
        },
        (error) => {
          console.error("Error getting location", error);
          const fallback = { lat: 19.4326, lng: -99.1332 }; // CDMX
          setLocation(fallback);
          setMapCenter(fallback);
          setLoading(false);
          generateNearbyEncounters(fallback.lat, fallback.lng).then(encounters => {
            setNearbyEncounters(encounters);
          });
        }
      );
    }
  }, []);

  // Sync profile edit state
  useEffect(() => {
    if (isEditingProfile) {
      setEditProfileName(userProfile.name);
      setEditProfileBio(userProfile.bio);
      setEditProfileAge(userProfile.age?.toString() || '');
      setEditQuickMessage(userProfile.quickMessage || '');
    }
  }, [isEditingProfile, userProfile]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (currentView === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, currentView, isTyping, activeChat]);

  // Apply Dark Mode Class to Body
  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [darkMode]);

  // --- Logic ---

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  // CRITICAL: Visibility Logic
  const visibleEncounters = useMemo(() => {
      if (myEncounters.length === 0) return [];

      return nearbyEncounters.filter(other => {
          if (!showHidden && other.status === EncounterStatus.HIDDEN) return false;

          const isCloseToAnyMine = myEncounters.some(mine => {
              const d = getDistanceInMeters(mine.location.lat, mine.location.lng, other.location.lat, other.location.lng);
              return d <= MATCH_RADIUS;
          });
          return isCloseToAnyMine;
      });
  }, [nearbyEncounters, myEncounters, showHidden]);

  const exploreList = useMemo(() => {
    if (exploreMode === 'drilldown' && exploreSelectedMyId) {
        const myPost = myEncounters.find(e => e.id === exploreSelectedMyId);
        if (!myPost) return [];
        return visibleEncounters.filter(other => {
            const d = getDistanceInMeters(myPost.location.lat, myPost.location.lng, other.location.lat, other.location.lng);
            return d <= MATCH_RADIUS;
        });
    }
    if (exploreMode === 'list') {
        let list = [...visibleEncounters];
        if (filterTags.length > 0) {
            list = list.filter(e => e.tags.some(tag => filterTags.includes(tag)));
        }
        return list;
    }
    return myEncounters;
  }, [visibleEncounters, myEncounters, exploreMode, exploreSelectedMyId, filterTags]);

  const handleSearchStreet = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (e) {
      console.error(e);
      showNotification('Error al buscar la ubicación', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    if (mapRef.current) {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      mapRef.current.flyTo([lat, lon], 16);
      setShowMapSearch(false);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const clusteredMarkers = useMemo(() => {
     let markersToShow: Encounter[] = [];
     if (mapFilters.mine) markersToShow.push(...myEncounters);
     const others = visibleEncounters.filter(e => {
       if (e.status === EncounterStatus.MATCHED) return mapFilters.match;
       if (e.status === EncounterStatus.LIKED_BY_THEM) return mapFilters.likedMe;
       if (e.status === EncounterStatus.HIDDEN) return showHidden; 
       return mapFilters.possible;
     });
     markersToShow.push(...others);

     if (!markersToShow.length) return { clusters: [], singles: [] };
     
     const threshold = mapZoom < 14 ? 0.005 : mapZoom < 16 ? 0.001 : 0.0002; 
     const clusters: { id: string; lat: number; lng: number; count: number; }[] = [];
     const singles: Encounter[] = [];
     const processedIds = new Set<string>();

     markersToShow.forEach(current => {
       if (processedIds.has(current.id)) return;
       const clusterGroup = [current];
       processedIds.add(current.id);

       markersToShow.forEach(other => {
         if (!processedIds.has(other.id)) {
           const dist = Math.sqrt(
             Math.pow(current.location.lat - other.location.lat, 
             Math.pow(current.location.lng - other.location.lng, 2)
           ));
           
           if (dist < threshold) {
             clusterGroup.push(other);
             processedIds.add(other.id);
           }
         }
       });

       if (clusterGroup.length > 1) {
         const avgLat = clusterGroup.reduce((sum, item) => sum + item.location.lat, 0) / clusterGroup.length;
         const avgLng = clusterGroup.reduce((sum, item) => sum + item.location.lng, 0) / clusterGroup.length;
         clusters.push({
           id: `cluster-${current.id}`,
           lat: avgLat,
           lng: avgLng,
           count: clusterGroup.length
         });
       } else {
         singles.push(current);
       }
     });

     return { clusters, singles };
  }, [visibleEncounters, myEncounters, mapZoom, mapFilters, showHidden]);

  // Notification for Drilldown
  useEffect(() => {
      if(exploreMode === 'drilldown' && exploreSelectedMyId) {
          const count = exploreList.length;
          if(count > 0) {
              showNotification(`${count} personas encontradas cerca`, 'info');
          }
      }
  }, [exploreMode, exploreSelectedMyId, exploreList?.length]);

  const totalUnreadCount = useMemo(() => {
    return chats.reduce((acc, chat) => acc + chat.unreadCount, 0);
  }, [chats]);

  // --- Handlers ---

  const handleStartLogin = () => {
    setLoginStep('register');
  };

  const handleFinishRegister = () => {
      if (!regName || !regAge) return; 
      setUserProfile(prev => ({
          ...prev,
          name: regName,
          age: parseInt(regAge),
          gender: regGender
      }));
      setLoginStep('app');
  };

  const handleSaveProfile = () => {
    setUserProfile(prev => ({
      ...prev,
      name: editProfileName,
      bio: editProfileBio,
      age: parseInt(editProfileAge),
      quickMessage: editQuickMessage
    }));
    setIsEditingProfile(false);
    showNotification('Perfil actualizado correctamente', 'success');
  };

  const handleCreateEncounter = () => {
    if (!mapCenter || !newEncounterTitle || !newEncounterDesc) return;
    if (myEncounters.length >= 5) {
      showNotification("Límite de 5 encuentros alcanzado", 'error');
      return;
    }

    const newEncounter: Encounter = {
      id: `mine-${Date.now()}`,
      userId: userProfile.id,
      userProfile: userProfile,
      title: newEncounterTitle,
      description: newEncounterDesc,
      location: mapCenter, 
      timestamp: Date.now(),
      status: EncounterStatus.PENDING,
      image: newEncounterImage,
      distance: 0,
      tags: newEncounterTags
    };

    setMyEncounters(prev => [newEncounter, ...prev]);
    setNewEncounterTitle('');
    setNewEncounterDesc('');
    setNewEncounterImage(undefined);
    setNewEncounterTags([]);
    setCurrentView('main');
    setActiveTab('explore'); 
    setExploreMode('grouped');
    showNotification("Encuentro publicado con éxito", 'success');
  };

  const handleQuickPublish = () => {
    if (!mapCenter) return;
    if (myEncounters.length >= 5) {
      showNotification("Límite de 5 encuentros alcanzado", 'error');
      return;
    }

    const newEncounter: Encounter = {
      id: `mine-quick-${Date.now()}`,
      userId: userProfile.id,
      userProfile: userProfile,
      title: "Miradas Cruzadas",
      description: userProfile.quickMessage || "Me llamaste la atención, me pareciste linda e interesante",
      location: mapCenter,
      timestamp: Date.now(),
      status: EncounterStatus.PENDING,
      image: userProfile.images[0], // Cover image
      distance: 0,
      tags: ['Cruzamos miradas']
    };

    setMyEncounters(prev => [newEncounter, ...prev]);
    showNotification("¡Encuentro publicado rápidamente!", 'success');
    setActiveTab('explore');
    setCurrentView('main'); // Ensure we leave the create view if triggered from there
  };

  const toggleTagSelection = (tag: EncounterTag) => {
    setNewEncounterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };
  
  const toggleFilterTag = (tag: EncounterTag) => {
    setFilterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleConnect = async (encounter: Encounter) => {
    const isInstantMatch = encounter.status === EncounterStatus.LIKED_BY_THEM;
    const newStatus = isInstantMatch ? EncounterStatus.MATCHED : EncounterStatus.LIKED_BY_ME;
    const updatedEncounter = { ...encounter, status: newStatus };
    setNearbyEncounters(prev => prev.map(e => e.id === encounter.id ? updatedEncounter : e));
    setSelectedEncounter(updatedEncounter); 

    if (isInstantMatch) {
       setShowMatchOverlay({ visible: true, partner: encounter.userProfile });
       const initialMsg = await generateInitialMessage(encounter.title);
       const newChat: Chat = {
           encounterId: encounter.id,
           partnerName: encounter.userProfile.name,
           partnerImage: encounter.userProfile.images[0],
           unreadCount: 1,
           messages: [
               { id: 'sys-1', senderId: 'system', text: `¡Es un Match!`, timestamp: Date.now() },
               { id: 'initial-1', senderId: encounter.userId, text: initialMsg, timestamp: Date.now() + 1000 }
           ]
       };
       setChats(prev => [newChat, ...prev]);
    } else {
        showNotification("Le has dado 'Me Gusta'", 'success');
    }
  };

  const handleReject = () => {
      if (!selectedEncounter) return;
      const updated = { ...selectedEncounter, status: EncounterStatus.HIDDEN };
      setNearbyEncounters(prev => prev.map(e => e.id === selectedEncounter.id ? updated : e));
      setSelectedEncounter(null);
      setCurrentView('main');
      showNotification("Encuentro ocultado", 'info');
  };

  const handleUnmatch = () => {
      if (!selectedEncounter) return;
      setNearbyEncounters(prev => prev.map(e => {
        if (e.id === selectedEncounter.id) {
          return { ...e, status: EncounterStatus.PENDING }; 
        }
        return e;
      }));
      setChats(prev => prev.filter(c => c.encounterId !== selectedEncounter.id));
      setShowUnmatchDialog(false);
      setSelectedEncounter(null);
      setCurrentView('main');
      setActiveChat(null);
      showNotification("Match cancelado", 'info');
  };

  const openChat = (encounterId: string) => {
      let chat = chats.find(c => c.encounterId === encounterId);
      if (!chat) {
          const enc = nearbyEncounters.find(e => e.id === encounterId);
          if (enc) {
              const newChat: Chat = {
                  encounterId: enc.id,
                  partnerName: enc.userProfile.name,
                  partnerImage: enc.userProfile.images[0],
                  unreadCount: 0,
                  messages: [
                       { id: 'sys-recovery', senderId: 'system', text: `¡Es un Match!`, timestamp: Date.now() }
                  ]
              };
              setChats(prev => [...prev, newChat]);
              chat = newChat;
          }
      }

      if (chat) {
          const updatedChat = { ...chat, unreadCount: 0 };
          setChats(prev => prev.map(c => c.encounterId === encounterId ? updatedChat : c));
          setActiveChat(updatedChat);
          setCurrentView('chat');
          setShowMatchOverlay({ visible: false, partner: null });
      }
  };

  const handleViewProfile = (encounterId: string) => {
      const enc = nearbyEncounters.find(e => e.id === encounterId);
      if(enc) {
          setSelectedEncounter(enc);
          setCurrentView('details');
      }
  }

  const sendMessage = (text: string) => {
      if (!activeChat) return;
      const msg: ChatMessage = {
          id: `msg-${Date.now()}`,
          senderId: userProfile.id,
          text,
          timestamp: Date.now()
      };
      
      const updatedChat = { ...activeChat, messages: [...activeChat.messages, msg] };
      setActiveChat(updatedChat);
      setChats(prev => prev.map(c => c.encounterId === activeChat.encounterId ? updatedChat : c));
      
      setIsTyping(true);

      setTimeout(() => {
          setIsTyping(false);
          const reply: ChatMessage = {
              id: `reply-${Date.now()}`,
              senderId: 'partner',
              text: "¡Jaja! Totalmente. ¿Sigues por la zona?",
              timestamp: Date.now()
          };
          const replyChat = { 
            ...updatedChat, 
            messages: [...updatedChat.messages, reply],
          };
          
          setActiveChat(prev => {
             if (prev && prev.encounterId === activeChat.encounterId) {
                return replyChat;
             }
             return prev;
          });

          setChats(prev => prev.map(c => {
              if (c.encounterId === activeChat.encounterId) {
                  return currentView === 'chat' && activeChat.encounterId === c.encounterId 
                    ? replyChat 
                    : { ...replyChat, unreadCount: c.unreadCount + 1 };
              }
              return c;
          }));
          
          if(currentView !== 'chat') {
             showNotification(`Nuevo mensaje de ${activeChat.partnerName}`, 'success');
          }

      }, 2500);
  };

  const toggleMockImage = () => {
    if (newEncounterImage) {
      setNewEncounterImage(undefined);
    } else {
      setNewEncounterImage(`https://picsum.photos/seed/${Date.now()}/500/300`);
    }
  };

  const handleMapZoomIn = () => { if(mapRef.current) mapRef.current.zoomIn(); };
  const handleMapZoomOut = () => { if(mapRef.current) mapRef.current.zoomOut(); };
  const handleMapLocate = () => { if(mapRef.current && location) mapRef.current.flyTo([location.lat, location.lng], 16); };

  const getMarkerIcon = (encounter: Encounter) => {
    if (encounter.userId === userProfile.id) return myIcon;
    if (encounter.status === EncounterStatus.MATCHED) return matchIcon;
    if (encounter.status === EncounterStatus.LIKED_BY_THEM) return likedMeIcon;
    return possibleIcon;
  };

  // --- Gesture Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current;
    
    // Only allow dragging UP
    if (deltaY < 0) {
        setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
      // Threshold to trigger quick publish (e.g. -200px)
      if (dragOffset < -200) {
          handleQuickPublish();
      }
      // Reset
      setDragOffset(0);
      setIsDragging(false);
      touchStartRef.current = null;
  };

  // --- Renders ---

  if (loginStep === 'landing') {
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-rose-600 to-pink-700 relative overflow-hidden">
         {/* ... Same landing ... */}
         <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
         <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-rose-400/20 rounded-full blur-3xl"></div>
         <div className="bg-white p-6 rounded-3xl shadow-2xl mb-8 transform -rotate-6 z-10">
            <Heart className="text-rose-600 w-20 h-20 fill-rose-600" />
         </div>
         <h1 className="text-5xl font-bold text-white mb-2 z-10 tracking-tight">Encuentros</h1>
         <p className="text-rose-100 text-center mb-16 max-w-xs z-10 text-lg">
           Conecta con quien acabas de cruzar miradas.
         </p>
         <button 
           onClick={handleStartLogin}
           className="bg-white text-gray-800 font-bold py-4 px-8 rounded-2xl shadow-xl flex items-center space-x-3 active:scale-95 transition-transform w-full max-w-xs justify-center z-10"
         >
           <LogIn size={20} />
           <span>Ingresar con Google</span>
         </button>
      </div>
    );
  }

  if (loginStep === 'register') {
      return (
          <div className="h-full bg-white dark:bg-gray-900 dark:text-white flex flex-col px-8 py-10 animate-in fade-in duration-300">
             {/* ... Same register ... */}
             <button onClick={() => setLoginStep('landing')} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 mb-6">
                  <ArrowLeft className="text-gray-800 dark:text-white" />
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Crea tu perfil</h1>
              {/* ... form ... */}
              <div className="space-y-6 flex-1 mt-6">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
                      <input 
                        type="text" 
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        className="w-full text-lg border-b-2 border-gray-200 dark:border-gray-700 focus:border-rose-500 outline-none py-2 bg-transparent dark:text-white"
                        placeholder="Ej. Alex"
                        autoFocus
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Edad</label>
                      <input 
                        type="number" 
                        value={regAge}
                        onChange={e => setRegAge(e.target.value)}
                        className="w-full text-lg border-b-2 border-gray-200 dark:border-gray-700 focus:border-rose-500 outline-none py-2 bg-transparent dark:text-white"
                        placeholder="25"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Género</label>
                      <div className="flex gap-4">
                          {(['male', 'female', 'other'] as const).map(g => (
                              <button
                                key={g}
                                onClick={() => setRegGender(g)}
                                className={`flex-1 py-3 rounded-xl border-2 font-semibold capitalize transition-colors ${
                                    regGender === g 
                                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' 
                                    : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                }`}
                              >
                                  {g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : 'Otro'}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
              <button 
                onClick={handleFinishRegister}
                disabled={!regName || !regAge}
                className="w-full bg-rose-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                  <span>Continuar</span>
                  <ChevronRight size={20} />
              </button>
          </div>
      );
  }

  if (loading || !location) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-900">
         <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-rose-500 border-opacity-50"></div>
         <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">Buscando encuentros cercanos...</p>
      </div>
    );
  }

  // View: Create Encounter
  if (currentView === 'create') {
    return (
      <div className="h-full bg-white dark:bg-gray-900 dark:text-white flex flex-col">
        {/* ... Create View Header ... */}
        <header className="px-4 py-4 flex items-center border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => setCurrentView('main')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={24} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="ml-2 text-xl font-bold text-gray-800 dark:text-white">Nuevo Encuentro</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {/* Quick Publish Action */}
           <div className="mb-6">
               <button 
                 onClick={handleQuickPublish}
                 className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
               >
                  <Zap size={20} className="fill-white" />
                  <span>Publicación Rápida (Usar Perfil)</span>
               </button>
               <div className="flex items-center gap-3 mt-6 mb-2">
                   <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                   <span className="text-gray-400 text-xs font-bold uppercase">O crea uno detallado</span>
                   <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
               </div>
           </div>

           <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl flex items-start border border-blue-100 dark:border-blue-800">
              <MapPin size={20} className="text-blue-500 dark:text-blue-300 mt-0.5 mr-2 shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-200">
                Se publicará en la ubicación central del mapa (la mira).
              </p>
           </div>

           <div 
             onClick={toggleMockImage}
             className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl h-48 transition-colors cursor-pointer ${
               newEncounterImage 
                ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20' 
                : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
             }`}
           >
              {newEncounterImage ? (
                <div className="relative w-full h-full">
                  <img src={newEncounterImage} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                    <span className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold shadow">Toca para quitar</span>
                  </div>
                </div>
              ) : (
                <>
                  <Camera size={40} className="text-gray-400 mb-2" />
                  <span className="text-gray-400 text-sm font-medium">Añadir foto (Opcional)</span>
                </>
              )}
           </div>

           <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título llamativo</label>
                <input 
                  type="text" 
                  value={newEncounterTitle}
                  onChange={(e) => setNewEncounterTitle(e.target.value)}
                  placeholder="Ej: Chica del libro rojo..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-rose-500 outline-none bg-gray-50 dark:bg-gray-800 text-lg"
                />
              </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Etiquetas</label>
                 <div className="flex flex-wrap gap-2">
                   {AVAILABLE_TAGS.map(tag => (
                     <button
                       key={tag}
                       onClick={() => toggleTagSelection(tag)}
                       className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                         newEncounterTags.includes(tag) 
                           ? 'bg-rose-500 text-white border-rose-500' 
                           : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                       }`}
                     >
                       {tag}
                     </button>
                   ))}
                 </div>
               </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">¿Qué pasó?</label>
                <textarea 
                  value={newEncounterDesc}
                  onChange={(e) => setNewEncounterDesc(e.target.value)}
                  placeholder="Cruzamos miradas en el semáforo..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-rose-500 outline-none bg-gray-50 dark:bg-gray-800 h-32 resize-none"
                />
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
           <button 
             onClick={handleCreateEncounter}
             disabled={!newEncounterTitle || !newEncounterDesc}
             className="w-full bg-rose-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 transition-transform disabled:opacity-50"
           >
             Publicar Encuentro
           </button>
        </div>
      </div>
    );
  }

  // View: Encounter Details
  if (currentView === 'details' && selectedEncounter) {
    const isMatched = selectedEncounter.status === EncounterStatus.MATCHED;
    const isLiked = selectedEncounter.status === EncounterStatus.LIKED_BY_ME;
    const displayImage = selectedEncounter.image || selectedEncounter.userProfile.images[0];

    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col relative">
         {/* ... Details View ... */}
         {showUnmatchDialog && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6 animate-in fade-in">
                 <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
                     <div className="flex flex-col items-center text-center mb-6">
                         <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-full mb-4">
                             <AlertTriangle className="text-red-500 w-8 h-8" />
                         </div>
                         <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cancelar el match?</h3>
                         <p className="text-gray-500 dark:text-gray-400 text-sm">
                             Esta acción es irreversible. Se eliminará el chat y la conexión.
                         </p>
                     </div>
                     <div className="flex gap-3">
                         <button 
                           onClick={() => setShowUnmatchDialog(false)}
                           className="flex-1 py-3 text-gray-700 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200"
                         >
                             Volver
                         </button>
                         <button 
                           onClick={handleUnmatch}
                           className="flex-1 py-3 text-white font-bold bg-red-500 rounded-xl shadow-lg"
                         >
                             Cancelar Match
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {/* Image Section */}
         <div className={`relative h-2/5`}>
             <img 
               src={displayImage} 
               className="w-full h-full object-cover cursor-pointer" 
               alt="Encounter" 
               onClick={() => selectedEncounter.image && setGalleryImages([selectedEncounter.image])}
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <button 
              onClick={() => setCurrentView('main')} 
              className="absolute top-4 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/30"
            >
              <ArrowLeft size={24} />
            </button>
            
            <div className="absolute bottom-8 left-6 right-6 pb-2">
                <div className="flex gap-2 mb-2">
                    {selectedEncounter.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-rose-600/80 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase">{t}</span>
                    ))}
                </div>
                <h1 className="text-3xl font-bold text-white mb-1 shadow-sm leading-tight">{selectedEncounter.title}</h1>
            </div>
         </div>

         {/* Content Section */}
         <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 rounded-t-3xl -mt-6 relative z-10 px-6 pt-8 pb-24 no-scrollbar">
            
            {/* User Profile Mini */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
               <div className="flex items-center">
                   <div className="relative">
                     <img 
                       src={selectedEncounter.userProfile.images[0]} 
                       className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
                       alt="Profile"
                     />
                   </div>
                   <div className="ml-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedEncounter.userProfile.name}</h3>
                      <button 
                        className="text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center hover:underline"
                        onClick={() => {}}
                      >
                         <Eye size={14} className="mr-1" /> Ver Perfil
                      </button>
                   </div>
               </div>
            </div>

            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">La Historia</h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg mb-8">
               {selectedEncounter.description}
            </p>

            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Fotos del perfil</h4>
            <div className="grid grid-cols-2 gap-3 mb-8">
               {selectedEncounter.userProfile.images.map((img, idx) => (
                  <img 
                    key={idx} 
                    src={img} 
                    className="rounded-xl w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    alt={`Gallery ${idx}`} 
                    onClick={() => setGalleryImages(selectedEncounter.userProfile.images)}
                  />
               ))}
            </div>
         </div>

         {/* Actions */}
         <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-gray-900 via-white dark:via-gray-900 to-transparent flex items-center justify-center gap-4 pb-8 z-20">
            {isMatched ? (
               <div className="flex w-full gap-4 items-center justify-center">
                   <button 
                     onClick={() => setShowUnmatchDialog(true)}
                     className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 w-14 h-14 rounded-full shadow flex items-center justify-center hover:bg-red-50 hover:text-red-500"
                   >
                       <X size={24} />
                   </button>
                   <button 
                     onClick={() => openChat(selectedEncounter.id)}
                     className="bg-gradient-to-r from-green-500 to-emerald-600 text-white w-20 h-20 rounded-full shadow-xl shadow-green-200 dark:shadow-none flex items-center justify-center active:scale-95 transition-all"
                   >
                     <MessageCircle size={36} className="fill-white/20" />
                   </button>
               </div>
            ) : isLiked ? (
               <div className="text-gray-500 font-bold flex items-center gap-2 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 px-6 py-3 rounded-full">
                  <Check size={20} /> Solicitud Enviada
               </div>
            ) : (
               <>
                 <button 
                   onClick={handleReject}
                   className="w-16 h-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-red-500 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-gray-700 active:scale-90 transition-transform"
                 >
                   <X size={32} />
                 </button>
                 
                 <button 
                   onClick={() => handleConnect(selectedEncounter)}
                   className="w-16 h-16 bg-gradient-to-tr from-rose-500 to-pink-600 text-white rounded-full shadow-xl shadow-rose-200 dark:shadow-none flex items-center justify-center hover:opacity-90 active:scale-90 transition-transform"
                 >
                   <Heart size={32} className="fill-white" />
                 </button>
               </>
            )}
         </div>
      </div>
    );
  }

  // View: Chat
  if (currentView === 'chat' && activeChat) {
      return (
          <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
              <header className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center shadow-sm sticky top-0 z-10 dark:border-b dark:border-gray-800">
                  <button onClick={() => setCurrentView('main')} className="mr-3">
                      <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                  </button>
                  <img 
                      src={activeChat.partnerImage} 
                      className="w-10 h-10 rounded-full object-cover mr-3 cursor-pointer" 
                      alt="Partner" 
                      onClick={() => handleViewProfile(activeChat.encounterId)}
                  />
                  <span 
                      className="font-bold text-gray-800 dark:text-white cursor-pointer"
                      onClick={() => handleViewProfile(activeChat.encounterId)}
                  >
                      {activeChat.partnerName}
                  </span>
              </header>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gray-50 dark:bg-gray-900">
                  {activeChat.messages.map(msg => {
                      const isMe = msg.senderId === userProfile.id;
                      const isSystem = msg.senderId === 'system';
                      if(isSystem) {
                          return (
                              <div key={msg.id} className="flex justify-center my-4 animate-in fade-in zoom-in duration-300">
                                  <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                                      {msg.text}
                                  </span>
                              </div>
                          );
                      }
                      return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed shadow-sm ${
                                  isMe 
                                  ? 'bg-rose-600 text-white rounded-br-none' 
                                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                              }`}>
                                  {msg.text}
                              </div>
                          </div>
                      );
                  })}
                  {isTyping && (
                      <div className="flex justify-start animate-in fade-in slide-in-from-bottom-1">
                          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                      </div>
                  )}
                  <div ref={messagesEndRef} />
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-8">
                  <form onSubmit={(e) => {
                      e.preventDefault();
                      const input = (e.currentTarget.elements.namedItem('msg') as HTMLInputElement);
                      if(input.value.trim()) {
                          sendMessage(input.value);
                          input.value = '';
                      }
                  }} className="flex items-center gap-2">
                      <input 
                        name="msg"
                        type="text" 
                        placeholder="Escribe un mensaje..." 
                        className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-rose-200 transition-all"
                        autoComplete="off"
                        autoFocus
                      />
                      <button type="submit" className="bg-rose-600 p-3 rounded-full text-white shadow-md active:scale-95 transition-transform hover:bg-rose-700">
                          <Send size={20} />
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  // --- Main Tabs View ---

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative transition-colors duration-300">
      
      {/* Toast Notification System */}
      {notification && (
        <div className={`absolute top-10 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[2000] animate-in slide-in-from-top fade-in flex items-center gap-2 whitespace-nowrap ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 
            notification.type === 'success' ? 'bg-green-500 text-white' : 
            'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900'
        }`}>
           {notification.type === 'error' && <AlertTriangle size={16}/>}
           {notification.type === 'success' && <Check size={16}/>}
           {notification.type === 'info' && <Bell size={16}/>}
           {notification.message}
        </div>
      )}

      {/* Match Overlay */}
      {showMatchOverlay.visible && showMatchOverlay.partner && (
         <MatchOverlay 
           userImage={userProfile.images[0]}
           partnerImage={showMatchOverlay.partner.images[0]}
           partnerName={showMatchOverlay.partner.name}
           onClose={() => setShowMatchOverlay({visible: false, partner: null})}
           onChat={() => {
               if(selectedEncounter) openChat(selectedEncounter.id);
           }}
         />
      )}

      {/* Image Gallery */}
      {galleryImages && (
          <ImageGallery images={galleryImages} onClose={() => setGalleryImages(null)} />
      )}

      {/* Quick Publish Drop Zone */}
      {isDragging && (
          <div className={`absolute inset-0 z-[1900] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${dragOffset < -200 ? 'opacity-100' : 'opacity-0'}`}>
              <div className={`bg-white/20 p-8 rounded-full border-4 border-dashed border-white text-white font-bold text-center transform transition-transform duration-300 ${dragOffset < -200 ? 'scale-110' : 'scale-100'}`}>
                  <Zap size={48} className="mx-auto mb-2" />
                  <p>Soltar para<br/>Publicar Rápido</p>
              </div>
          </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* Tab: Map */}
        <div className={`absolute inset-0 flex flex-col ${activeTab === 'map' ? 'z-10 visible' : 'z-0 invisible'}`}>
           <MapContainer 
             ref={mapRef}
             center={[location.lat, location.lng]} 
             zoom={mapZoom} 
             scrollWheelZoom={true}
             zoomControl={false}
             attributionControl={false}
             className="flex-1"
           >
             <TileLayer
               url={darkMode 
                   ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                   : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
             />
             <MapEvents 
                onZoom={setMapZoom} 
                onMoveEnd={() => {
                  if(mapRef.current) {
                    const c = mapRef.current.getCenter();
                    setMapCenter({ lat: c.lat, lng: c.lng });
                  }
                }}
             />
             <MapController center={null} />

             {/* User's GPS Marker */}
             <Marker position={[location.lat, location.lng]} icon={createIcon('#f59e0b')} zIndexOffset={500}>
                <Popup>Tu ubicación GPS</Popup>
             </Marker>

             {/* Clusters & Markers */}
             {clusteredMarkers.clusters.map(cluster => (
                 <Marker 
                    key={cluster.id}
                    position={[cluster.lat, cluster.lng]}
                    icon={createClusterIcon(cluster.count)}
                    eventHandlers={{
                       click: () => {
                         if (mapRef.current) {
                           mapRef.current.flyTo([cluster.lat, cluster.lng], Math.min(mapZoom + 2, 18), { duration: 0.5 });
                         }
                       }
                    }}
                 />
             ))}

             {clusteredMarkers.singles.map(encounter => (
                 <Marker 
                    key={encounter.id} 
                    position={[encounter.location.lat, encounter.location.lng]}
                    icon={getMarkerIcon(encounter)}
                    eventHandlers={{
                        click: () => {
                            setSelectedEncounter(encounter);
                            setCurrentView('details');
                        }
                    }}
                  />
             ))}

           </MapContainer>

           {/* Central Crosshair */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
              <div className="relative">
                 <div className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-md"></div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-rose-600/50 rounded-full"></div>
              </div>
           </div>

           {/* Search Button */}
           <div className="absolute top-4 left-4 z-[500]">
              <button 
                 onClick={() => setShowMapSearch(!showMapSearch)}
                 className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg text-gray-700 dark:text-white active:scale-95 transition-transform"
              >
                  <Search size={24} />
              </button>
           </div>
           
           {/* Map Search Overlay */}
           {showMapSearch && (
             <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/95 dark:bg-gray-900/95 z-[490] p-6 animate-in slide-in-from-left duration-300 overflow-y-auto dark:text-white">
                <div className="flex items-center mb-6">
                   <button onClick={() => setShowMapSearch(false)} className="mr-4">
                      <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                   </button>
                   <h2 className="text-xl font-bold">Buscar y Filtrar</h2>
                </div>

                <div className="mb-6">
                    <div className="relative">
                        <input 
                           type="text"
                           placeholder="Buscar calle o zona..."
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                           className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-xl pl-10 outline-none focus:ring-2 focus:ring-rose-200"
                           onKeyDown={(e) => e.key === 'Enter' && handleSearchStreet()}
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        {isSearching && <div className="absolute right-3 top-3.5 animate-spin w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full"></div>}
                    </div>
                    {searchResults.length > 0 && (
                       <ul className="mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {searchResults.map((result, idx) => (
                             <li 
                               key={idx} 
                               onClick={() => handleSelectSearchResult(result)}
                               className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-0 cursor-pointer text-sm"
                             >
                                {result.display_name}
                             </li>
                          ))}
                       </ul>
                    )}
                </div>

                <div className="mb-6">
                   <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Layers size={18}/> Filtros del Mapa</h3>
                   <div className="space-y-3">
                       <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                           <span className="font-medium">Mostrar Ocultos / Rechazados</span>
                           <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} className="w-5 h-5 accent-gray-500" />
                       </label>

                       <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>

                      <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                         <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: ICON_COLORS.MINE }}></div>
                         <span className="flex-1 font-medium">Mis Encuentros</span>
                         <input type="checkbox" checked={mapFilters.mine} onChange={e => setMapFilters({...mapFilters, mine: e.target.checked})} className="w-5 h-5 accent-rose-500" />
                      </label>
                      {/* ... other filters ... */}
                   </div>
                </div>
             </div>
           )}
           
           {/* Map Controls */}
           <div className="absolute bottom-6 right-4 flex flex-col gap-3 z-[400]">
               <button 
                 onClick={handleMapLocate}
                 className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg text-gray-700 dark:text-white active:scale-95"
               >
                   <Locate size={24} />
               </button>
               <div className="flex flex-col bg-white dark:bg-gray-800 rounded-full shadow-lg overflow-hidden">
                   <button 
                     onClick={handleMapZoomIn}
                     className="p-3 border-b border-gray-100 dark:border-gray-700 text-gray-700 dark:text-white"
                   >
                       <ZoomIn size={24} />
                   </button>
                   <button 
                     onClick={handleMapZoomOut}
                     className="p-3 text-gray-700 dark:text-white"
                   >
                       <ZoomOut size={24} />
                   </button>
               </div>
           </div>
        </div>

        {/* Tab: Explore */}
        {activeTab === 'explore' && (
           <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
             {/* Header */}
             <header className="px-6 py-4 bg-white dark:bg-gray-900 shadow-sm z-10 dark:border-b dark:border-gray-800">
               <div className="flex justify-between items-center mb-4">
                  {exploreMode === 'drilldown' ? (
                      <div className="flex items-center">
                          <button onClick={() => setExploreMode('grouped')} className="mr-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                              <ArrowLeft size={20} className="dark:text-white" />
                          </button>
                          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Coincidencias</h1>
                      </div>
                  ) : (
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Explorar</h1>
                  )}
                  
                  {exploreMode !== 'drilldown' && (
                      <button 
                        onClick={() => setExploreMode(exploreMode === 'grouped' ? 'list' : 'grouped')} 
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors border ${
                            exploreMode === 'grouped'
                            ? 'bg-rose-600 text-white border-rose-600' 
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {exploreMode === 'grouped' ? 'Ver por Publicación' : 'Ver Todo el Mapa'}
                      </button>
                  )}
               </div>

               {/* Tags */}
               {exploreMode === 'list' && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {AVAILABLE_TAGS.map(tag => (
                        <button 
                            key={tag} 
                            onClick={() => toggleFilterTag(tag)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border ${
                                filterTags.includes(tag) 
                                ? 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 border-rose-200' 
                                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
               )}
             </header>

             {/* Content */}
             <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {exploreMode === 'grouped' && (
                    <div className="space-y-4">
                        {myEncounters.length === 0 ? (
                            <div className="text-center py-10">
                                <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 mb-4">No has publicado ningún encuentro.</p>
                                <button onClick={() => setCurrentView('create')} className="text-rose-600 font-bold">Crear uno ahora</button>
                            </div>
                        ) : (
                            myEncounters.map(mine => {
                                const count = visibleEncounters.filter(other => {
                                    return getDistanceInMeters(mine.location.lat, mine.location.lng, other.location.lat, other.location.lng) <= MATCH_RADIUS
                                }).length;

                                return (
                                    <div 
                                        key={mine.id} 
                                        onClick={() => {
                                            setExploreSelectedMyId(mine.id);
                                            setExploreMode('drilldown');
                                        }}
                                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between active:scale-95 transition-transform"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
                                                <img src={mine.image || userProfile.images[0]} className="w-full h-full object-cover" alt="Post" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{mine.title}</h3>
                                                <div className="flex items-center text-rose-500 font-medium text-sm mt-1">
                                                    <Users size={16} className="mr-1" />
                                                    {count} Personas cerca
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="text-gray-300" />
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {(exploreMode === 'list' || exploreMode === 'drilldown') && (
                    <>
                        {exploreList.length === 0 ? (
                             <div className="text-center py-10 text-gray-400">
                                <Tag size={40} className="mx-auto mb-2 opacity-20" />
                                <p>No se encontraron personas cerca.</p>
                            </div>
                        ) : (
                            exploreList.map(encounter => (
                                <EncounterCard 
                                    key={encounter.id} 
                                    encounter={encounter} 
                                    onPress={() => {
                                        setSelectedEncounter(encounter);
                                        setCurrentView('details');
                                    }}
                                />
                            ))
                        )}
                    </>
                )}
             </div>
           </div>
        )}

        {/* Tab: Matches */}
        {activeTab === 'matches' && (
           <div className="absolute inset-0 bg-white dark:bg-gray-900 flex flex-col">
              <header className="px-6 py-6 border-b border-gray-100 dark:border-gray-800">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mensajes</h1>
              </header>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                  {chats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                          <MessageCircle size={64} className="mb-4" />
                          <p>Aún no tienes matches.</p>
                      </div>
                  ) : (
                      chats.map(chat => (
                          <div 
                             key={chat.encounterId} 
                             onClick={() => {
                                 const updatedChat = { ...chat, unreadCount: 0 };
                                 setChats(prev => prev.map(c => c.encounterId === chat.encounterId ? updatedChat : c));
                                 setActiveChat(updatedChat);
                                 setCurrentView('chat');
                             }}
                             className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 transition-colors"
                          >
                             <div className="relative">
                               <img src={chat.partnerImage} className="w-14 h-14 rounded-full object-cover border border-gray-100 dark:border-gray-700" alt="Partner" />
                               {chat.unreadCount > 0 && (
                                   <div className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                       {chat.unreadCount}
                                   </div>
                               )}
                             </div>
                             <div className="ml-4 flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                   <h3 className={`font-bold ${chat.unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-400'}`}>{chat.partnerName}</h3>
                                   <span className="text-xs text-gray-400">
                                       {new Date(chat.messages[chat.messages.length - 1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                   </span>
                                </div>
                                <p className={`text-sm truncate max-w-[200px] ${chat.unreadCount > 0 ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
                                    {chat.messages[chat.messages.length - 1].text}
                                </p>
                             </div>
                          </div>
                      ))
                  )}
              </div>
           </div>
        )}

        {/* Tab: Profile */}
        {activeTab === 'profile' && (
           <div className="absolute inset-0 bg-white dark:bg-gray-900 overflow-y-auto no-scrollbar">
               {/* ... Profile Image Header ... */}
               <div className="relative">
                   <div className="h-48 bg-rose-200 dark:bg-rose-900"></div>
                   <div className="absolute -bottom-16 left-6">
                       <img 
                         src={userProfile.images[0]} 
                         className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-900 shadow-md object-cover" 
                         alt="Profile"
                       />
                       {isEditingProfile && (
                           <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white cursor-pointer">
                               <Camera size={24} />
                           </div>
                       )}
                   </div>
                   <button onClick={() => setLoginStep('landing')} className="absolute top-4 right-4 bg-white/30 backdrop-blur-md p-2 rounded-full text-white"><LogOut size={20}/></button>
               </div>
               
               <div className="mt-20 px-6 pb-24">
                   <div className="flex justify-between items-start">
                       <div className="w-full">
                            {isEditingProfile ? (
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Nombre</label>
                                    <input 
                                        className="text-2xl font-bold text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700 focus:border-rose-500 outline-none w-full py-1 bg-transparent"
                                        value={editProfileName}
                                        onChange={(e) => setEditProfileName(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{userProfile.name}</h1>
                            )}
                            
                            <div className="flex items-center text-gray-500 dark:text-gray-400 mt-1">
                                {isEditingProfile ? (
                                    <div className="flex items-center">
                                        <label className="text-xs font-bold text-gray-400 uppercase mr-2">Edad:</label>
                                        <input 
                                            type="number"
                                            className="text-lg w-16 border-b border-gray-300 dark:border-gray-700 focus:border-rose-500 outline-none bg-transparent"
                                            value={editProfileAge}
                                            onChange={(e) => setEditProfileAge(e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-lg mr-2">{userProfile.age} años</span>
                                )}
                                <span className="w-1 h-1 bg-gray-400 rounded-full mx-2"></span>
                                <span className="capitalize">{userProfile.gender === 'male' ? 'Hombre' : userProfile.gender === 'female' ? 'Mujer' : 'Otro'}</span>
                            </div>
                       </div>
                   </div>

                   {isEditingProfile ? (
                       <div className="mt-4 space-y-4">
                           <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Bio</label>
                                <textarea 
                                    className="w-full mt-1 p-3 border dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-200 outline-none text-gray-600 dark:text-gray-300 text-lg bg-transparent"
                                    value={editProfileBio}
                                    onChange={(e) => setEditProfileBio(e.target.value)}
                                    rows={3}
                                />
                           </div>
                           <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-800">
                                <label className="text-xs font-bold text-rose-500 uppercase flex items-center gap-2">
                                    <Zap size={14}/> Mensaje Rápido
                                </label>
                                <p className="text-xs text-gray-400 mb-2">Se usa al deslizar el botón + hacia arriba.</p>
                                <textarea 
                                    className="w-full p-2 border-b border-rose-200 dark:border-rose-800 focus:border-rose-500 outline-none text-gray-700 dark:text-gray-200 bg-transparent"
                                    value={editQuickMessage}
                                    onChange={(e) => setEditQuickMessage(e.target.value)}
                                    rows={2}
                                    placeholder="Mensaje por defecto para publicación rápida..."
                                />
                           </div>
                       </div>
                   ) : (
                       <p className="text-gray-500 dark:text-gray-400 mt-4 text-lg leading-relaxed">{userProfile.bio}</p>
                   )}
                   
                   {/* Settings Section (New) */}
                   <div className="mt-8">
                       <div className="flex items-center justify-between mb-4">
                           <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                               <Settings size={18} /> Configuración
                           </h3>
                       </div>
                       <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   {darkMode ? <Moon size={20} className="text-rose-500"/> : <Sun size={20} className="text-gray-500"/>}
                                   <span className="font-medium text-gray-700 dark:text-gray-200">Modo Oscuro</span>
                               </div>
                               <button 
                                 onClick={() => setDarkMode(!darkMode)}
                                 className={`w-12 h-6 rounded-full p-1 transition-colors relative ${darkMode ? 'bg-rose-600' : 'bg-gray-300'}`}
                               >
                                   <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                               </button>
                           </div>
                       </div>
                   </div>

                   {/* My Encounters Section */}
                   <div className="mt-8 mb-8">
                      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2 mb-4">
                          <h3 className="font-bold text-gray-900 dark:text-white">Mis Encuentros ({myEncounters.length}/5)</h3>
                      </div>
                      {myEncounters.length > 0 ? (
                        <div className="space-y-4">
                          {myEncounters.map(encounter => (
                              <div key={encounter.id} className="relative">
                                  <EncounterCard 
                                    encounter={encounter} 
                                    onPress={() => {}} 
                                    showStatus={true}
                                  />
                                  <button 
                                    onClick={() => {
                                        setMyEncounters(p => p.filter(e => e.id !== encounter.id));
                                        showNotification("Encuentro eliminado", 'info');
                                    }}
                                    className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 shadow-sm"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No has publicado encuentros aún.</p>
                      )}
                   </div>

                   <button 
                     onClick={isEditingProfile ? handleSaveProfile : () => setIsEditingProfile(true)}
                     className={`w-full mt-4 mb-10 py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${
                         isEditingProfile ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                     }`}
                   >
                       {isEditingProfile ? <><Save size={20} /> Guardar Cambios</> : 'Editar Perfil'}
                   </button>
               </div>
           </div>
        )}

      </div>

      {/* Bottom Navigation Bar */}
      <nav className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-2 pb-4 pt-2 flex items-end justify-between sticky bottom-0 z-[1000] h-20">
         <button 
           onClick={() => { setActiveTab('map'); setCurrentView('main'); }}
           className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'map' ? 'text-rose-600' : 'text-gray-400'}`}
         >
            <MapIcon size={24} className={activeTab === 'map' ? 'fill-rose-100 dark:fill-rose-900' : ''} />
            <span className="text-[10px] font-medium mt-1">Mapa</span>
         </button>
         
         <button 
           onClick={() => { setActiveTab('explore'); setCurrentView('main'); setExploreMode('grouped'); }}
           className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'explore' ? 'text-rose-600' : 'text-gray-400'}`}
         >
            <Navigation size={24} className={activeTab === 'explore' ? 'fill-rose-100 dark:fill-rose-900' : ''} />
            <span className="text-[10px] font-medium mt-1">Explorar</span>
         </button>

         {/* Center Add Button with Drag Gesture */}
         <div 
            className="relative -top-5 mx-2 touch-none select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
                transform: `translateY(${dragOffset}px)`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
         >
            <button 
                onClick={() => setCurrentView('create')}
                className="bg-rose-600 text-white p-4 rounded-full shadow-xl shadow-rose-200 dark:shadow-none border-4 border-gray-50 dark:border-gray-900 active:scale-95 transition-transform"
            >
                <Plus size={28} />
            </button>
         </div>

         <button 
           onClick={() => { setActiveTab('matches'); setCurrentView('main'); }}
           className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'matches' ? 'text-rose-600' : 'text-gray-400'} relative`}
         >
            <MessageCircle size={24} className={activeTab === 'matches' ? 'fill-rose-100 dark:fill-rose-900' : ''} />
            {totalUnreadCount > 0 && (
                <span className="absolute top-1 right-6 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
            )}
            <span className="text-[10px] font-medium mt-1">Chat</span>
         </button>

         <button 
           onClick={() => { setActiveTab('profile'); setCurrentView('main'); }}
           className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'profile' ? 'text-rose-600' : 'text-gray-400'}`}
         >
            <User size={24} className={activeTab === 'profile' ? 'fill-rose-100 dark:fill-rose-900' : ''} />
            <span className="text-[10px] font-medium mt-1">Perfil</span>
         </button>
      </nav>

    </div>
  );
}

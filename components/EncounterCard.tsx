import React from 'react';
import { Encounter, EncounterStatus } from '../types';
import { MapPin, Heart, MessageCircle } from 'lucide-react';

interface Props {
  encounter: Encounter;
  onPress: () => void;
  showStatus?: boolean;
}

export const EncounterCard: React.FC<Props> = ({ encounter, onPress, showStatus = true }) => {
  const isMatch = encounter.status === EncounterStatus.MATCHED;
  const isLikedByMe = encounter.status === EncounterStatus.LIKED_BY_ME;
  const isLikedByThem = encounter.status === EncounterStatus.LIKED_BY_THEM;

  // Logic: If encounter has image, use it. Else use user's first image (profile/cover).
  const displayImage = encounter.image || encounter.userProfile.images[0];

  return (
    <div 
      onClick={onPress}
      className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden active:scale-95 transition-transform duration-200 border border-gray-100 relative group"
    >
      <div className={`relative h-48 bg-gray-100 transition-all`}>
        {displayImage ? (
          <img src={displayImage} alt={encounter.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-pink-50 to-purple-50">
             <MapPin className="text-pink-200 w-10 h-10" />
          </div>
        )}
        
        {/* If using fallback image, add an overlay so text/avatar pops */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>

        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center shadow-sm">
           <img 
             src={encounter.userProfile.images[0]} 
             className="w-6 h-6 rounded-full mr-2 object-cover border border-gray-200" 
             alt="avatar"
           />
           <span className="text-xs font-semibold text-gray-700 max-w-[80px] truncate">
             {encounter.userProfile.name}
           </span>
        </div>

        {showStatus && (
           <div className="absolute bottom-3 left-3">
              {isMatch && (
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center shadow-lg">
                    <MessageCircle size={12} className="mr-1" /> Match!
                  </span>
              )}
              {isLikedByThem && (
                 <span className="bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center shadow-lg">
                   <Heart size={12} className="mr-1 fill-white" /> Le gustaste
                 </span>
              )}
               {isLikedByMe && !isMatch && (
                 <span className="bg-gray-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                   Pendiente...
                 </span>
              )}
           </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex flex-wrap gap-1 mb-2">
            {encounter.tags.map(tag => (
                <span key={tag} className="text-[10px] uppercase font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-md">
                    {tag}
                </span>
            ))}
        </div>
        <div className="flex justify-between items-start mb-1">
           <h3 className="text-lg font-bold text-gray-900 leading-tight">{encounter.title}</h3>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{encounter.description}</p>
      </div>
    </div>
  );
};
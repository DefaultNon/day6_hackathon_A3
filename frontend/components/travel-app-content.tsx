'use client'

import { useState, useCallback, useMemo, createContext, useContext, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ChatAgent from '@/components/chat-agent'
import LocationSheet from '@/components/location-sheet'
import ItineraryCard from '@/components/itinerary-card'
import {
  type Attraction,
  type Itinerary,
  type RouteSegment,
  ATTRACTIONS,
  USER_LOCATION,
  getAttractionsWithinRadius,
  calculateDistance,
  estimateTravelCost,
  estimateTravelTime,
} from '@/lib/attractions'
import { MapPin, Navigation, Minus, Plus, Search, Menu, Bot, Sparkles } from 'lucide-react'

// Context to share mode with child components
type AppMode = 'fullscreen' | 'framed'
const AppModeContext = createContext<AppMode>('fullscreen')
export const useAppMode = () => useContext(AppModeContext)

// Dynamically import map to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/map-view'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <div className="text-muted-foreground">Loading map...</div>
    </div>
  ),
})

interface TravelAppContentProps {
  mode?: AppMode
}

export default function TravelAppContent({ mode = 'fullscreen' }: TravelAppContentProps) {
  const [radius, setRadius] = useState(10) // km
  const [selectedAttractions, setSelectedAttractions] = useState<Attraction[]>([])
  const [detailAttraction, setDetailAttraction] = useState<Attraction | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [allAttractions, setAllAttractions] = useState<Attraction[]>([])
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [isSuccessToastVisible, setIsSuccessToastVisible] = useState(false)

  // Hàm xử lý khi người dùng nhấn Đặt trọn gói Tour
  const handleBookTour = () => {
    setIsBookingModalOpen(true)
  }

  // Xác nhận đặt tour thành công
  const confirmBooking = () => {
    setIsBookingModalOpen(false)
    setIsSuccessToastVisible(true)
    setTimeout(() => setIsSuccessToastVisible(false), 5000)
  }

  const handleBookRide = () => {
    if (itinerary) {
      console.log("Booking ride for:", itinerary.destinations[0].name)
      setIsSuccessToastVisible(true)
      setTimeout(() => setIsSuccessToastVisible(false), 3000)
    }
  }

  // Fetch attractions from backend
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    fetch(`${apiUrl}/attractions`)
      .then(res => res.json())
      .then(data => setAllAttractions(data))
      .catch(err => console.error('Failed to fetch attractions:', err))
  }, [])

  // Get attractions within current radius
  const attractions = useMemo(
    () => getAttractionsWithinRadius(USER_LOCATION, radius, allAttractions),
    [radius, allAttractions]
  )

  // Handle attraction selection
  const handleAttractionSelect = useCallback((attraction: Attraction) => {
    setSelectedAttractions((prev) => {
      const exists = prev.some((a) => a.id === attraction.id)
      if (exists) {
        return prev.filter((a) => a.id !== attraction.id)
      }
      return [...prev, attraction]
    })
  }, [])

  // Handle radius change
  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(Math.max(5, Math.min(30, newRadius)))
  }, [])

  // Generate itinerary from selected attractions using Nearest Neighbor algorithm
  const generateItinerary = useCallback((selected: Attraction[]) => {
    if (selected.length === 0) return

    const unvisited = [...selected]
    const sorted: Attraction[] = []
    let currentPos = USER_LOCATION

    // Nearest Neighbor algorithm
    while (unvisited.length > 0) {
      let closestIdx = 0
      let minDistance = calculateDistance(currentPos, unvisited[0].coordinates)

      for (let i = 1; i < unvisited.length; i++) {
        const dist = calculateDistance(currentPos, unvisited[i].coordinates)
        if (dist < minDistance) {
          minDistance = dist
          closestIdx = i
        }
      }

      const closest = unvisited.splice(closestIdx, 1)[0]
      // Ensure distance is correct relative to previous stop
      closest.distance = minDistance
      sorted.push(closest)
      currentPos = closest.coordinates
    }

    // Calculate routes between destinations
    const routes: RouteSegment[] = []
    let totalDistance = 0
    let totalTime = 0
    let totalCost = 0

    // First leg: user to first destination
    const firstDistance = calculateDistance(USER_LOCATION, sorted[0].coordinates)
    const firstTime = estimateTravelTime(firstDistance)
    const firstCost = estimateTravelCost(firstDistance)
    routes.push({
      from: { id: 'user', name: 'Your Location', coordinates: USER_LOCATION } as Attraction,
      to: sorted[0],
      distance: firstDistance,
      travelTime: firstTime,
      cost: firstCost,
    })
    totalDistance += firstDistance
    totalTime += firstTime + sorted[0].estimatedVisitTime
    totalCost += firstCost

    // Subsequent legs
    for (let i = 0; i < sorted.length - 1; i++) {
      const distance = calculateDistance(sorted[i].coordinates, sorted[i + 1].coordinates)
      const travelTime = estimateTravelTime(distance)
      const cost = estimateTravelCost(distance)
      routes.push({
        from: sorted[i],
        to: sorted[i + 1],
        distance,
        travelTime,
        cost,
      })
      totalDistance += distance
      totalTime += travelTime + sorted[i + 1].estimatedVisitTime
      totalCost += cost
    }

    setItinerary({
      destinations: sorted,
      totalDistance,
      totalTime,
      estimatedCost: totalCost,
      routes,
    })
  }, [])

  // Close itinerary
  const handleCloseItinerary = useCallback(() => {
    setItinerary(null)
  }, [])

  const isFramed = mode === 'framed'

  return (
    <AppModeContext.Provider value={mode}>
      <div className="h-full w-full relative overflow-hidden bg-background">
        {/* Header */}
        <header className={`${isFramed ? 'absolute' : 'fixed'} top-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-b safe-area-top`}>
          <div className={`${isFramed ? 'px-3 py-2' : 'px-4 py-3'} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className={`${isFramed ? 'w-7 h-7' : 'w-9 h-9'} rounded-full bg-primary flex items-center justify-center`}>
                <Navigation className={`${isFramed ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary-foreground`} />
              </div>
              <div>
                <h1 className={`font-semibold ${isFramed ? 'text-sm' : 'text-base'} text-foreground`}>Explore Nearby</h1>
                <p className={`${isFramed ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Hoi An, Vietnam</p>
              </div>
            </div>
            
            {/* Radius control */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className={`${isFramed ? 'h-7 w-7' : 'h-8 w-8'}`}
                onClick={() => handleRadiusChange(radius - 5)}
                disabled={radius <= 5}
              >
                <Minus className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>
              <Badge variant="secondary" className={`${isFramed ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
                {radius} km
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className={`${isFramed ? 'h-7 w-7' : 'h-8 w-8'}`}
                onClick={() => handleRadiusChange(radius + 5)}
                disabled={radius >= 30}
              >
                <Plus className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>
            </div>
          </div>
          
          {/* Selection indicator */}
          {selectedAttractions.length > 0 && (
            <div className={`${isFramed ? 'px-3 py-1.5' : 'px-4 py-2'} bg-primary/5 border-t flex items-center justify-between`}>
              <div className="flex items-center gap-1.5">
                <MapPin className={`${isFramed ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary`} />
                <span className={`${isFramed ? 'text-xs' : 'text-sm'} text-foreground`}>
                  {selectedAttractions.length} place{selectedAttractions.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-1">
                {selectedAttractions.length >= 2 && !itinerary && (
                  <Button
                    size="sm"
                    className={`${isFramed ? 'h-6 text-xs px-2' : 'h-7 text-sm px-3'}`}
                    onClick={() => generateItinerary(selectedAttractions)}
                  >
                    Build Itinerary
                  </Button>
                )}
                {selectedAttractions.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${isFramed ? 'h-6 text-xs px-2' : 'h-7 text-sm px-3'}`}
                    onClick={() => setSelectedAttractions([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Map */}
        <div className={`absolute inset-0 ${isFramed ? 'pt-[52px]' : 'pt-[56px]'}`}>
          <MapView
            attractions={attractions}
            radius={radius}
            selectedAttractions={selectedAttractions}
            itinerary={itinerary}
            onAttractionSelect={handleAttractionSelect}
            onAttractionDetails={setDetailAttraction}
          />
        </div>

        {/* Stats overlay */}
        <div className={`${isFramed ? 'absolute top-[60px] left-3' : 'fixed top-[68px] left-4'} z-20`}>
          <div className={`bg-card/95 backdrop-blur-sm rounded-lg shadow-lg ${isFramed ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
            <span className="text-muted-foreground">Found </span>
            <span className="font-semibold text-foreground">{attractions.length}</span>
            <span className="text-muted-foreground"> places</span>
          </div>
        </div>

        {/* Itinerary card */}
        {itinerary && (
          <ItineraryCard
            itinerary={itinerary}
            onClose={handleCloseItinerary}
            onBookRide={handleBookRide}
            onBookTour={handleBookTour}
          />
        )}

        {/* Booking Confirmation Dialog */}
        {isBookingModalOpen && itinerary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-bold mb-2">Xác nhận đặt Tour</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Bạn đang thực hiện đặt trọn gói hành trình khám phá {itinerary.destinations.length} địa điểm.
              </p>
              
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng quãng đường:</span>
                  <span className="font-semibold">{itinerary.totalDistance.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng thời gian di chuyển:</span>
                  <span className="font-semibold">{Math.floor(itinerary.totalTime / 60)}h {itinerary.totalTime % 60}m</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-base">
                  <span className="font-bold">Tổng chi phí ước tính:</span>
                  <span className="font-bold text-orange-600">{(itinerary.estimatedCost).toLocaleString()} VND</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsBookingModalOpen(false)}>Hủy</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={confirmBooking}>Xác nhận đặt ngay</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Success Toast Notification */}
        {isSuccessToastVisible && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4">
            <Badge className="bg-green-600 text-white px-4 py-2 text-sm shadow-xl flex gap-2 items-center">
              <Sparkles className="h-4 w-4" />
              Đặt chỗ thành công! Chúng tôi đã gửi email xác nhận.
            </Badge>
          </div>
        )}

        {/* Chat agent */}
        <ChatAgent
          attractions={attractions}
          selectedAttractions={selectedAttractions}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          onSelectAttraction={handleAttractionSelect}
          onGenerateItinerary={generateItinerary}
          onShowLocation={(attraction) => {
            setDetailAttraction(attraction)
          }}
          itinerary={itinerary}
          hideButton={!!itinerary}
        />

        {/* Location detail sheet */}
        <LocationSheet
          attraction={detailAttraction}
          isOpen={!!detailAttraction}
          onClose={() => setDetailAttraction(null)}
          isSelected={selectedAttractions.some((a) => a.id === detailAttraction?.id)}
          onToggleSelect={handleAttractionSelect}
        />
      </div>
    </AppModeContext.Provider>
  )
}

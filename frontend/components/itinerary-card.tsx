'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type Itinerary, getTypeColor, getTypeLabel } from '@/lib/attractions'
import {
  X,
  Clock,
  MapPin,
  Banknote,
  Navigation,
  ChevronDown,
  Car
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAppMode } from './travel-app-content'

interface ItineraryCardProps {
  itinerary: Itinerary
  onClose: () => void
  onBookRide: () => void
  onBookTour: () => void // Thêm prop để xử lý đặt trọn gói tour
}

export default function ItineraryCard({
  itinerary,
  onClose,
  onBookRide,
  onBookTour,
}: ItineraryCardProps) {
  const mode = useAppMode()
  const isFramed = mode === 'framed'
  const [isExpanded, setIsExpanded] = useState(true)

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hrs === 0) return `${mins} min`
    return `${hrs}h ${mins}m`
  }

  const formatCost = (cost: number) => {
    return `${cost.toLocaleString()} VND` // Đổi sang VND cho phù hợp với bối cảnh Việt Nam
  }

  return (
    <Card className={cn(
      "z-40 shadow-2xl border-0 overflow-hidden flex flex-col",
      isFramed
        ? "absolute bottom-2 left-2 right-2 max-h-[60%]"
        : "fixed bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:w-[380px] max-h-[50vh]"
    )}>
      {/* Header */}
      <div
        className={cn(
          "bg-primary text-primary-foreground flex items-center justify-between cursor-pointer",
          isFramed ? "px-3 py-2" : "px-4 py-3"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`flex items-center ${isFramed ? 'gap-1.5' : 'gap-2'}`}>
          <Navigation className={isFramed ? "h-4 w-4" : "h-5 w-5"} />
          <span className={`font-semibold ${isFramed ? 'text-sm' : 'text-base'}`}>Hành trình của bạn</span>
          <Badge variant="secondary" className={cn(
            "bg-primary-foreground/20 text-primary-foreground",
            isFramed ? "text-xs px-1.5" : "text-sm px-2"
          )}>
            {itinerary.destinations.length} điểm dừng
          </Badge>
        </div>
        <div className={`flex items-center ${isFramed ? 'gap-1.5' : 'gap-2'}`}>
          <ChevronDown className={cn(
            "transition-transform",
            isFramed ? "h-3 w-3" : "h-4 w-4",
            isExpanded ? '' : 'rotate-180'
          )} />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className={cn(
              "hover:bg-primary-foreground/20 rounded-full transition-colors",
              isFramed ? "p-0.5" : "p-1"
            )}
          >
            <X className={isFramed ? "h-3 w-3" : "h-4 w-4"} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Số liệu thống kê tóm tắt */}
          <div className={cn(
            "bg-muted/50 border-b flex justify-between",
            isFramed ? "px-3 py-2" : "px-4 py-3"
          )}>
            <div className={`flex items-center ${isFramed ? 'gap-1' : 'gap-1.5'}`}>
              <MapPin className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
              <span className={`font-medium ${isFramed ? 'text-xs' : 'text-sm'}`}>{itinerary.totalDistance.toFixed(1)} km</span>
            </div>
            <div className={`flex items-center ${isFramed ? 'gap-1' : 'gap-1.5'}`}>
              <Clock className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
              <span className={`font-medium ${isFramed ? 'text-xs' : 'text-sm'}`}>{formatTime(itinerary.totalTime)}</span>
            </div>
            <div className={`flex items-center ${isFramed ? 'gap-1' : 'gap-1.5'}`}>
              <Banknote className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
              <span className={`font-medium ${isFramed ? 'text-xs' : 'text-sm'}`}>{formatCost(itinerary.estimatedCost)}</span>
            </div>
          </div>

          {/* Route details */}
          <ScrollArea className={cn("flex-1 min-h-0", isFramed ? "max-h-[200px]" : "max-h-[280px]")}>
            <div className={isFramed ? "p-2" : "p-3"}>
              {/* Điểm xuất phát */}
              <div className={`flex ${isFramed ? 'gap-2 mb-1.5' : 'gap-3 mb-2'}`}>
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "rounded-full bg-primary border-2 border-white shadow",
                    isFramed ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <div className={cn(
                    "bg-primary/30",
                    isFramed ? "w-0.5 h-6" : "w-0.5 h-8"
                  )} />
                </div>
                <div>
                  <p className={cn(
                    "font-medium text-muted-foreground",
                    isFramed ? "text-[10px]" : "text-xs"
                  )}>Vị trí của bạn</p>
                  <p className={`font-semibold ${isFramed ? 'text-xs' : 'text-sm'}`}>Điểm bắt đầu</p>
                </div>
              </div>

              {/* Các điểm đến trong lịch trình */}
              {itinerary.destinations.map((destination, index) => {
                const route = itinerary.routes[index]
                const isLast = index === itinerary.destinations.length - 1

                return (
                  <div key={destination.id}>
                    {/* Đoạn đường di chuyển */}
                    {route && (
                      <div className={cn(
                        "flex",
                        isFramed ? "gap-2 mb-1 pl-1" : "gap-3 mb-1.5 pl-1.5"
                      )}>
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "bg-primary/30",
                            isFramed ? "w-0.5 h-4" : "w-0.5 h-6"
                          )} />
                        </div>
                        <div className={cn(
                          "flex items-center text-muted-foreground",
                          isFramed ? "gap-1.5 text-[10px]" : "gap-2 text-xs"
                        )}>
                          <Car className={isFramed ? "h-2.5 w-2.5" : "h-3 w-3"} />
                          <span>{route.distance.toFixed(1)}km</span>
                          <span>|</span>
                          <span>{formatTime(route.travelTime)}</span>
                          <span>|</span>
                          <span>{formatCost(route.cost)}</span>
                        </div>
                      </div>
                    )}

                    {/* Điểm dừng chân */}
                    <div className={`flex ${isFramed ? 'gap-2 mb-1.5' : 'gap-3 mb-2'}`}>
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "rounded-full border-2 border-white shadow",
                            isFramed ? "w-3 h-3" : "w-4 h-4"
                          )}
                          style={{ backgroundColor: getTypeColor(destination.type) }}
                        />
                        {!isLast && <div className={cn(
                          "bg-primary/30",
                          isFramed ? "w-0.5 h-6" : "w-0.5 h-8"
                        )} />}
                      </div>
                      <div className="flex-1">
                        <div className={`flex items-center ${isFramed ? 'gap-1' : 'gap-1.5'}`}>
                          <span className={cn(
                            "text-muted-foreground",
                            isFramed ? "text-[10px]" : "text-xs"
                          )}>Stop {index + 1}</span>
                          <Badge
                            variant="outline"
                            className={isFramed ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0"}
                            style={{ borderColor: getTypeColor(destination.type), color: getTypeColor(destination.type) }}
                          >
                            {getTypeLabel(destination.type)}
                          </Badge>
                        </div>
                        <p className={`font-semibold ${isFramed ? 'text-xs' : 'text-sm'}`}>{destination.name}</p>
                        <p className={cn(
                          "text-muted-foreground flex items-center",
                          isFramed ? "text-[10px] gap-0.5" : "text-xs gap-1"
                        )}>
                          <Clock className={isFramed ? "h-2.5 w-2.5" : "h-3 w-3"} />
                          Tham quan {destination.estimatedVisitTime} phút
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {/* Action button */}
          <div className={cn("border-t", isFramed ? "p-2" : "p-3")}>
            <Button
              className={`w-full ${isFramed ? 'h-9 text-sm' : 'h-10 text-base'}`}
              onClick={onBookRide}
            >
              <Car className={`${isFramed ? 'h-3.5 w-3.5 mr-1.5' : 'h-4 w-4 mr-2'}`} />
              Đặt xe đến điểm đầu tiên
            </Button>
            <Button
              className={`w-full bg-orange-600 hover:bg-orange-700 ${isFramed ? 'h-9 text-sm' : 'h-10 text-base'}`}
              onClick={onBookTour}
            >
              <Banknote className={`${isFramed ? 'h-3.5 w-3.5 mr-1.5' : 'h-4 w-4 mr-2'}`} />
              Đặt trọn gói Tour này
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

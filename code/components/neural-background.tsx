'use client'

import { useEffect, useRef } from 'react'

type NetworkNode = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  phase: number
  pulseSpeed: number
}

type NeuralBackgroundProps = {
  className?: string
}

export function NeuralBackground({ className = '' }: NeuralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let animationFrame = 0
    const nodes: NetworkNode[] = []

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const nextWidth = bounds.width
      const nextHeight = bounds.height
      const scaleX = width ? nextWidth / width : 1
      const scaleY = height ? nextHeight / height : 1
      nodes.forEach((node) => { node.x *= scaleX; node.y *= scaleY })
      width = nextWidth
      height = nextHeight
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      if (nodes.length === 0) {
        for (let index = 0; index < 55; index += 1) {
          nodes.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.38,
            vy: (Math.random() - 0.5) * 0.38,
            radius: Math.random() * 1.4 + 1,
            phase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.018 + Math.random() * 0.018,
          })
        }
      }
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)
      nodes.forEach((node) => {
        if (!reducedMotion) {
          node.x += node.vx
          node.y += node.vy
          node.phase += node.pulseSpeed
          if (node.x < 0 || node.x > width) node.vx *= -1
          if (node.y < 0 || node.y > height) node.vy *= -1
        }
      })

      for (let first = 0; first < nodes.length; first += 1) {
        for (let second = first + 1; second < nodes.length; second += 1) {
          const dx = nodes[first].x - nodes[second].x
          const dy = nodes[first].y - nodes[second].y
          const distance = Math.hypot(dx, dy)
          if (distance < 140) {
            context.beginPath()
            context.moveTo(nodes[first].x, nodes[first].y)
            context.lineTo(nodes[second].x, nodes[second].y)
            context.strokeStyle = `rgba(30, 100, 255, ${(1 - distance / 140) * 0.14})`
            context.lineWidth = 0.7
            context.stroke()
          }
        }
      }

      nodes.forEach((node) => {
        const pulse = reducedMotion ? 0.5 : (Math.sin(node.phase) + 1) / 2
        const radius = node.radius * (1 + pulse * 0.4)
        const glow = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius)
        glow.addColorStop(0, `rgba(120, 180, 255, ${0.55 + pulse * 0.25})`)
        glow.addColorStop(1, 'rgba(30, 100, 255, 0.18)')
        context.beginPath()
        context.arc(node.x, node.y, radius, 0, Math.PI * 2)
        context.fillStyle = glow
        context.fill()
      })

      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw)
    }

    const handleResize = () => {
      resize()
      if (reducedMotion) draw()
    }

    resize()
    draw()
    window.addEventListener('resize', handleResize)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

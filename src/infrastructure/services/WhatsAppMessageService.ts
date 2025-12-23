/**
 * Servicio para generar mensajes de WhatsApp según la decisión de la solicitud de préstamo
 */
export class WhatsAppMessageService {
  /**
   * Genera un mensaje de WhatsApp para solicitud aprobada
   */
  static generateApprovalMessage(data: {
    nombre: string;
    montoAprobado: number;
    montoSolicitado: number;
    trackingNumber: number;
    comentario?: string;
  }): string {
    const { nombre, montoAprobado, montoSolicitado, trackingNumber, comentario } = data;
    
    let message = `🎉 ¡Felicitaciones ${nombre}!\n\n`;
    message += `Tu solicitud de préstamo #${trackingNumber} ha sido *APROBADA*.\n\n`;
    message += `📊 Detalles de tu préstamo:\n`;
    message += `• Monto solicitado: RD$ ${montoSolicitado.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    message += `• Monto aprobado: RD$ ${montoAprobado.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    
    if (comentario) {
      message += `📝 Comentario: ${comentario}\n\n`;
    }
    
    message += `Nuestro equipo se pondrá en contacto contigo pronto para completar el proceso.\n\n`;
    message += `¡Gracias por confiar en nosotros! 🙏`;
    
    return message;
  }

  /**
   * Genera un mensaje de WhatsApp para solicitud rechazada
   */
  static generateRejectionMessage(data: {
    nombre: string;
    trackingNumber: number;
    comentario?: string;
  }): string {
    const { nombre, trackingNumber, comentario } = data;
    
    let message = `Hola ${nombre},\n\n`;
    message += `Lamentamos informarte que tu solicitud de préstamo #${trackingNumber} ha sido *RECHAZADA*.\n\n`;
    
    if (comentario) {
      message += `📝 Motivo: ${comentario}\n\n`;
    } else {
      message += `Nuestro equipo de evaluación ha revisado tu solicitud y no cumple con los criterios establecidos en este momento.\n\n`;
    }
    
    message += `Si tienes preguntas o deseas más información, puedes contactarnos.\n\n`;
    message += `Te invitamos a aplicar nuevamente en el futuro cuando tu situación crediticia mejore.\n\n`;
    message += `Gracias por tu interés. 🙏`;
    
    return message;
  }

  /**
   * Genera el mensaje según la decisión (aprobado o rechazado)
   */
  static generateMessage(
    decision: 'aprobado' | 'rechazado',
    data: {
      nombre: string;
      montoAprobado?: number;
      montoSolicitado?: number;
      trackingNumber: number;
      comentario?: string;
    }
  ): string {
    if (decision === 'aprobado') {
      if (!data.montoAprobado || !data.montoSolicitado) {
        throw new Error('montoAprobado y montoSolicitado son requeridos para mensajes de aprobación');
      }
      return this.generateApprovalMessage({
        nombre: data.nombre,
        montoAprobado: data.montoAprobado,
        montoSolicitado: data.montoSolicitado,
        trackingNumber: data.trackingNumber,
        comentario: data.comentario
      });
    } else {
      return this.generateRejectionMessage({
        nombre: data.nombre,
        trackingNumber: data.trackingNumber,
        comentario: data.comentario
      });
    }
  }
}

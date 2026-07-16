class StatusManager {
  static getChecklistStatus(formData) {
    const statuses = Object.values(formData).map(item => item.status);
    const allYes = statuses.every(status => status === 'Yes');
    const hasNo = statuses.some(status => status === 'No');
    
    if (allYes) {
      return 'Completed without NCs';
    } else if (hasNo) {
      return 'Awaiting for NC response';
    } else {
      return 'Awaiting for NC response';
    }
  }

  static getSupervisorReviewStatus(reviews, nonConformanceCount) {
    const reviewAnalysis = this.analyzeReviews(reviews, nonConformanceCount);
    
    const transitions = {
      'complete_accepted': 'Accepted by Supervisor',
      'has_rejected': 'Rejected by Supervisor',
      'incomplete': 'Under Supervisor Review'
    };
    
    return transitions[reviewAnalysis.type] || 'Under Supervisor Review';
  }

  static analyzeReviews(reviews, nonConformanceCount) {
    const allItemsReviewed = reviews.length === nonConformanceCount;
    const allAccepted = reviews.every(review => review.supervisor_status === 'Accepted');
    const hasRejected = reviews.some(review => review.supervisor_status === 'Rejected');
    
    if (allItemsReviewed && allAccepted) {
      return { type: 'complete_accepted', canAssignToManager: true };
    } else if (hasRejected) {
      return { type: 'has_rejected', canAssignToManager: false };
    } else {
      return { type: 'incomplete', canAssignToManager: false };
    }
  }

  static getNextAssignee(currentStatus, roster) {
    const assignmentFlow = {
      'Awaiting for NC response': roster.supervisor_id,
      'Accepted by Supervisor': roster.manager_id,
      'Rejected by Supervisor': roster.auditor_id
    };
    
    return assignmentFlow[currentStatus] || null;
  }

  static canUserAccess(userRole, checklistStatus, assignmentType = null) {
    const accessRules = {
      'Auditor': {
        pending: ['', 'Draft', 'Rejected by Supervisor'],
        completed: ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed']
      },
      'Supervisor': {
        pending: ['Awaiting for NC response'],
        completed: ['Accepted by Supervisor', 'Completed by Supervisor', 'Completed']
      },
      'Manager': {
        pending: ['Accepted by Supervisor', 'Completed by Supervisor'],
        completed: ['Completed', 'Completed without NCs']
      }
    };
    
    return accessRules[userRole] || { pending: [], completed: [] };
  }

  static getStatusBadgeClass(status) {
    const statusClasses = {
      'Completed': 'bg-green-100 text-green-800',
      'Completed without NCs': 'bg-green-100 text-green-800',
      'Awaiting for NC response': 'bg-yellow-100 text-yellow-800',
      'Accepted by Supervisor': 'bg-blue-100 text-blue-800',
      'Rejected by Supervisor': 'bg-red-100 text-red-800',
      'Under Supervisor Review': 'bg-orange-100 text-orange-800',
      'Draft': 'bg-gray-100 text-gray-800'
    };
    
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  }

  static isStatusTransitionValid(fromStatus, toStatus, userRole) {
    const validTransitions = {
      'Auditor': {
        '': ['Draft', 'Awaiting for NC response'],
        'Draft': ['Awaiting for NC response'],
        'Rejected by Supervisor': ['Awaiting for NC response']
      },
      'Supervisor': {
        'Awaiting for NC response': ['Accepted by Supervisor', 'Rejected by Supervisor', 'Under Supervisor Review']
      },
      'Manager': {
        'Accepted by Supervisor': ['Completed', 'Completed without NCs']
      }
    };
    
    const userTransitions = validTransitions[userRole] || {};
    const allowedTransitions = userTransitions[fromStatus] || [];
    
    return allowedTransitions.includes(toStatus);
  }
}

module.exports = StatusManager;
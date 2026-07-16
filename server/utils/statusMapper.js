/**
 * Status mapping utility for tickets
 * Maps user-facing status to database status
 */

class StatusMapper {
  /**
   * Map user-selected status to database status
   * @param {string} userStatus - Status selected by user
   * @returns {string} - Mapped database status
   */
  static mapToDbStatus(userStatus) {
    const statusMap = {
      'New': 'New',
      'Pending': 'Pending', 
      'In Progress': 'In Progress',
      'Completed': 'Completed',
      'Duplicate': 'Completed',
      'Ticket by mistake': 'Completed',
      'Raise': 'Raised'
    };

    return statusMap[userStatus] || userStatus;
  }

  /**
   * Get all available user-facing status options
   * @returns {Array} - Array of status options
   */
  static getUserStatusOptions() {
    return [
      'Pending',
      'In Progress', 
      'Completed',
      'Duplicate',
      'Ticket by mistake'
    ];
  }

  /**
   * Get all database status values
   * @returns {Array} - Array of database status values
   */
  static getDbStatusValues() {
    return [
      'New',
      'In Progress',
      'Pending', 
      'Completed',
      'Raised'
    ];
  }

  /**
   * Check if status should be marked as completed in database
   * @param {string} userStatus - Status selected by user
   * @returns {boolean} - True if should be marked as completed
   */
  static isCompletedStatus(userStatus) {
    return ['Completed', 'Duplicate', 'Ticket by mistake'].includes(userStatus);
  }
}

module.exports = StatusMapper;
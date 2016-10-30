/*!
  @file liblazurite.h
  @brief This file is header file of liblazurite.so <br>
  source code is "dyliblazurite.cpp"

  @section how to install
  @subsection install of LazDriver
  @code
  git clone git://github.com/LAPIS-Lazurite/LazDriver
  cd LazDriver
  make
  @endcode

  @subsection install of liblazurite
  @code
  git clone git://github.com/LAPIS-Lazurite/liblazurite
  cd liblazurite
  make
  @endcode

  then liblazurite is copied in /usr/lib

  @section about sample program
  sample code | build option | operation
  ------------| -------------| --------
  test_t      | tx           | sample of lazurite_write
  test_rx     | rx           | sample of lazurite_readPayload
  test_link   | link         | sample of lazurite_readLink
  test_raw    | raw          | sample of lazurite_read

  */
#ifndef _LIBLAZURITE_H_
#define _LIBLAZURITE_H_

#ifdef __cplusplus
namespace lazurite
{
	extern "C" {
#endif
/*! @struct SUBGHZ_MAC
  @brief  parameters of IEEE802154e
  */
		typedef struct {
			//time_t tv_sec;
			//long tv_nsec;
			uint16_t header;	/*!< header */
			uint8_t frame_type;	/*!< frame type */
			uint8_t sec_enb;	/*!< security enable */
			uint8_t pending;	/*!< pending */
			uint8_t ack_req;	/*!< ack request */
			uint8_t panid_comp;	/*!< panid comp */
			uint8_t seq_comp;	/*!< sequence compression */
			uint8_t ielist;	/*!< ielist */
			uint8_t tx_addr_type;	/*!< tx address type none/8bit/16bit/64bit */
			uint8_t frame_ver;	/*!< framce version */
			uint8_t rx_addr_type;	/*!< rx address type none/8bit/16bit/64bit */
			uint8_t seq_num;	/*!< sequence number */
			uint8_t addr_type;	/*!< address type */
			uint16_t rx_panid;	/*!< rx panid */
			uint8_t  rx_addr[8];	/*!< rx address */
			uint16_t tx_panid;	/*!< tx panid */
			uint8_t  tx_addr[8];	/*!< tx address */
			uint16_t payload_offset;	/*!< pointer of payload */
			uint16_t payload_len;	/*!<  length of payload */
			//uint8_t rssi;
		}SUBGHZ_MAC;

	/******************************************************************************/
	/*! @brief set linked address
	  addr = 0xffff		receiving all data
	  addr != 0xffff	receiving data of linked address only
	  @param[out]     addr   linked address
	  @par            Refer
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_link(uint16_t addr);
	/******************************************************************************/
	/*! @brief load LazDriver
	  @param      none
	  @return         0=success <br> 0 < fail
	  @exception  none
	  @todo  must be change folder name of lazdriver
	 ******************************************************************************/
	int lazurite_init(void);

	/******************************************************************************/
	/*! @brief remove driver from kernel
	  @param     none
	  @return         0=success <br> 0 < fail
	  @exception none
	 ******************************************************************************/
	int lazurite_remove(void);

	/******************************************************************************/
	/*! @brief set rx address to be sent
	  @param[out]     tmp_rxaddr   rxaddr to be sent
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setRxAddr(uint16_t tmp_rxaddr);

	/******************************************************************************/
	/*! @brief set PANID for TX
	  @param[out]     txpanid    set PANID(Personal Area Network ID) for sending
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setTxPanid(uint16_t txpanid);

	/******************************************************************************/
	/*! @brief setup lazurite module
	  @param[in]  ch (RF frequency)<br>
	  in case of 100kbps, ch is 24-31, 33-60<br>
	  in case of 50kbps, ch is 24-61
	  @param[in]  mypanid
	  set my PANID.
	  @param[in] rate 50 or 100<br>
	  100 = 100kbps<br>
	  50  = 50kbps 
	  @param[in] pwr 1 or 20<br>
	  1  = 1mW<br>
	  20 = 20mW
	  @return         0=success <br> 0 < fail
	  @exception  none
	 ******************************************************************************/
	int lazurite_begin(uint8_t ch, uint16_t mypanid, uint8_t rate,uint8_t pwr);

	/******************************************************************************/
	/*! @brief close driver (stop RF)
	  @param     none
	  @return         0=success <br> 0 < fail
	  @exception none
	 ******************************************************************************/
	int lazurite_close(void);

	/******************************************************************************/
	/*! @brief send data
	  @param[in]     rxpanid	panid of receiver
	  @param[in]     txaddr     16bit short address of receiver<br>
	  rxpanid & txaddr = 0xffff = broadcast <br>
	  others = unicast <br>
	  @param[in]     payload start poiter of data to be sent
	  @param[in]     length length of payload
	  @return         0=success=0 <br> -ENODEV = ACK Fail <br> -EBUSY = CCA Fail
	  @exception none
	 ******************************************************************************/
	int lazurite_send(uint16_t rxpanid,uint16_t rxaddr,const void* payload, uint16_t length);

	/******************************************************************************/
	/*! @brief enable RX
	  @param     none
	  @return         0=success <br> 0 < fail
	  @exception none
	 ******************************************************************************/
	int lazurite_rxEnable(void);

	/******************************************************************************/
	/*! @brief disable RX
	  @param     none
	  @return         0=success <br> 0 < fail
	  @exception none
	 ******************************************************************************/
	int lazurite_rxDisable(void);

	/******************************************************************************/
	/*! @brief get my address
	  @param[out]     short pointer to return my address
	  @return         0=success <br> 0 < fail
	  @exception none
	 ******************************************************************************/
	int lazurite_getMyAddress(uint16_t *myaddr);


	/******************************************************************************/
	/*! @brief send data via 920MHz
	  @param[in]     *payload     data 
	  @param[in]      size        data of length
	  @return         0=success=0 <br> -ENODEV = ACK Fail <br> -EBUSY = CCA Fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_write(const char* payload, uint16_t size);

	/******************************************************************************/
	/*! @brief decoding mac header for external function
	  @param[out]     *mac    result of decoding raw
	  @param[in]      *raw    raw data of ieee802154
	  @param[in]      raw_len length of raw
	  @return         length of raw data
	  @exception      none
	 ******************************************************************************/
	int lazurite_decMac(SUBGHZ_MAC* mac,void* raw,uint16_t raw_size);

	/******************************************************************************/
	/*! @brief get size of receiving data
	  @param      none
	  @return     length of receiving packet
	  @exception  none
	 ******************************************************************************/
	int lazurite_available(void);

	/******************************************************************************/
	/*! @brief read raw data
	  @param[out]     *raw
	  pointer to write received packet data.<br>
	  255 byte should be reserved.
	  @param[out]     size
	  size of raw data
	  @return     length of receiving packet
	  @exception  none
	 ******************************************************************************/
	int lazurite_read(void* raw, uint16_t* size);

	/******************************************************************************/
	/*! @brief read only payload. header is abandoned.
	  @param[out]     *payload    memory for payload to be written. need to reserve 250 byte in maximum.
	  @param[out]     *size       size of payload
	  @return         size of payload
	  @exception      none
	  @note           about lazurite_readPayload:
	  mac header is abandoned.
	 ******************************************************************************/
	int lazurite_readPayload(char* payload, uint16_t* size);
	
	/******************************************************************************/
	/*! @brief read payload from linked address
	  @param[out]     *payload   pointer of payload
	  @param[out]     *size       length of payload
	  @return         size
	  @exception      none
	  @note  About linkedAddress mode:
	  The size is length of receiving packet in kernel driver.
	  When tx address is wrong in linked address mode, lazurite_readPayload or lazurite_read return 0.
	  mac header is abandoned in this mode.
	 ******************************************************************************/
	int lazurite_readLink(char* payload, uint16_t* size);

	/******************************************************************************/
	/*! @brief get Receiving time
	  @param[out]     *tv_sec     32bit linux time data
	  @param[out]     *tv_nsec    32bit nsec time
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getRxTime(time_t* tv_sec,long* tv_nsec);

	/******************************************************************************/
	/*! @brief get RSSI of last receiving packet
	  @param[out]     *rssi   value of RSSI.  0-255. 255 is in maxim
	  @return         0 > rssi <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getRxRssi(void);

	/******************************************************************************/
	/*! @brief get RSSI of ack in last tx packet
	  @param[out]     *rssi   value of RSSI.  0-255. 255 is in maxim
	  @return         Success=0, Fail<0
	  @return         0 > rssi <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getTxRssi(void);

	/******************************************************************************/
	/*! @brief get address type
	  @param[in]     none 
	  @return         address type
	  type | rx_addr | tx_addr | panid_comp | rx panid | tx_panid
	  -----| --------| --------| ---------- | -------- | --------
	  0 | N | N | 0 | N | N
	  1 | N | N | 1 | Y | N
	  2 | N | Y | 0 | N | Y
	  3 | N | Y | 1 | N | N
	  4 | Y | N | 0 | Y | N
	  5 | Y | N | 1 | N | N
	  6 | Y | Y | 0 | Y | N
	  7 | Y | Y | 1 | N | N
	  @exception      none
	 ******************************************************************************/
	int lazurite_getAddrType(void);

	/******************************************************************************/
	/*! @brief set address type
	  @param[in]      mac address type to send
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setAddrType(uint8_t addr_type);

	/******************************************************************************/
	/*! @brief get CCA cycle Time
	  @param[in]     none 
	  @return         0 > senseTime <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getSenseTime(void);

	/******************************************************************************/
	/*! @brief set cycle of CCA
	  @param[in]      CCA cycle 0-255(20 in default)
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setSenseTime(uint8_t senseTime);

	/******************************************************************************/
	/*! @brief get cycle time to resend, when tx is failed.
	  @param[in]      none
	  @return         0 > txretry <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getTxRetry(void);

	/******************************************************************************/
	/*! @brief set cycle to resend, when Tx is failed.
	  @param[in]      retry cycle 0-255(3 in default)
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setTxRetry(uint8_t retry);

	/******************************************************************************/
	/*! @brief set tx interval until resend, when Tx is failed.
	  @param[in]      none
	  @return         txinterval(ms) >0 <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_getTxInterval(void);

	/******************************************************************************/
	/*! @brief set interval to resend, when tx is failed.
	  @param[in]      txinterval 0(0ms) - 500(500ms), 500 in default
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setTxInterval(uint16_t txinterval);

	/******************************************************************************/
	/*! @brief get backoff time
	  @param[in]      none
	  @return         0 > backoff time <br> 0 < fail <br>
	  backoff time = 320us * 2^cca_wait
	  @exception      none
	 ******************************************************************************/
	int lazurite_getCcaWait(void);

	/******************************************************************************/
	/*! @brief set cca backoff time
	  @param[in]      ccawait (0 - 7), 7 in default <br>
	  backoff time = 320us * 2^cca_wait
	  @return         0=success <br> 0 < fail
	  @exception      none
	 ******************************************************************************/
	int lazurite_setCcaWait(uint8_t ccawait);

#ifdef __cplusplus
	};
};
#endif
#endif

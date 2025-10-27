  
**Forward Deployed Engineer Exercise**  
[**Sample Data**](https://drive.google.com/drive/folders/1M5wsXkNyGsje6NVnaa3-xAb2-1H1_zdL?usp=drive_link)

# **Shipment Report Automation Project**

---

A Forward Deployed Engineer (FDE) works directly with clients to implement, customize, and integrate complex technical solutions on-site, bridging the gap between engineering and customer needs. The solutions focus on automating and optimizing workflows by deploying tailored software solutions that streamline operations and improve efficiency.

## **1\. Project Overview**

### **1.1 Background**

A leading freight forwarding (FF) company seeks to automate its customer reporting process. Currently, account managers manually compile shipment tracking data from multiple sources into Excel reports for key clients. This process takes 4–6 hours per week per manager and is prone to human error.

The compilation flow is as follows:

1) The account manager starts with their internal shipment data.  
2) They search Windward for matching shipments, which they enrich their internal data records with.  
3) If relevant (determined by Windward’s additional data), they check online to add relevant weather information for particular records.

### **1.2 Project Objective**

Develop an automated solution that aggregates data from various shipping information sources and generates customized Excel reports, minimizing manual work and increasing data accuracy.

### **1.3 Business Value**

* Reduce report generation time  
* Improve the FF’s customer satisfaction with timely and accurate reporting  
* Free up account managers to focus on value-added services  
* Enhance reports with AI-generated insights into shipment delays

## 

## 

## **2\. Input Data Description**

The solution must integrate with the following data sources:

#### **2.1 Logistics TMS API**

* Sample response data: `/api_samples/tms-data.json`  
* Endpoints (simulated with sample data):  
  * `GET /shipments/{id}` – Retrieve a specific shipment  
  * `GET /shipments` – Retrieve shipments within a date range  
* Key data: sqlShipmentNo, containers, routing details, milestones

#### **2.2 Windward API**

* Sample response data: `/api_samples/windward-data.json`  
* Endpoints (simulated with sample data):  
  * `GET /shipments/{id}` – Retrieve a specific shipment  
  * `GET /shipments?container={containerNumber}` – Retrieve a specific shipment by container  
  * `GET /shipments` – Retrieve shipments within a date range  
* Key data: containerNumber, ETA/ETD predictions vs ATA/ATD, delay information, destinationPort

#### **2.3 Weather Data API**

* You may use any public weather API (e.g. open-meteo.com)  
* Purpose: Enrich delay insights with contextual weather information e.g. temperature, wave height, wind speed and magnitude

---

## **3\. Deliverables**

### **3.1 Output**

####  **Tabular**

* CSV, or similar, file containing the pertinent information  
* Should contain the following fields: sglShipmentNo, customer.name, shipper.name, containerNumber, scac, initialCarrierETA, actualArrivalAt, delay.reasons,  
  (in case of weather reasons)temperature, wind  
* Bonus: UI, for improved usability

### **3.2 Source Code**

### **3.3 Documentation**

* How to run/deploy  
* How it should be called

## **4\. Resources Provided**

* **API Response Samples**:

  * TMS API  
  * Windward API  
  * Weather API

## **5\. Timeline and Support**

* **Estimated time**: 3–6 hours  
* **Support**: communication channel (e.g. Slack) for communicating with “customer” and “RnD” roles

## **6\. Submission Instructions**

Submit the following:

1. A GitHub repository or archive of the project code  
2. Setup and usage instructions (`README.md`, Docs, or other)

Good luck\!